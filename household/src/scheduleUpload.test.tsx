// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent as raw, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from './testing/events';
import { ScheduleUpload } from './components/ScheduleUpload';
import type { WorkEntry } from './data/types';
import { createScheduleReader, parseReadResult, toCandidates, type ReadResult } from './lib/scheduleUpload';

afterEach(cleanup);

const saved: WorkEntry = {
  id: 'wk-1', memberId: 'jay', date: '2026-10-06', start: '07:00', endDate: '2026-10-06', end: '15:00',
  createdBy: 'jay', createdAt: '2026-10-01T00:00', updatedBy: 'jay', updatedAt: '2026-10-01T00:00',
} as WorkEntry;

describe('reading a schedule: what comes back from the server', () => {
  it('keeps well-formed shifts, pads times and drops anything malformed with a note', () => {
    const r = parseReadResult({
      shifts: [
        { date: '2026-10-07', start: '7:00', endDate: '2026-10-07', end: '15:30', note: ' Store 12 ' },
        { date: 'Oct 8', start: '07:00', endDate: '2026-10-08', end: '15:00' },
        { date: '2026-10-09', start: '25:00', endDate: '2026-10-09', end: '15:00' },
        'nonsense',
      ],
      warnings: ['Oct 10 time was smudged', 4],
    });
    expect(r.shifts).toEqual([{ date: '2026-10-07', start: '07:00', endDate: '2026-10-07', end: '15:30', note: 'Store 12' }]);
    expect(r.warnings).toEqual(['Oct 10 time was smudged', '3 items couldn’t be read as a shift and were left out.']);
  });

  it('survives an empty or garbage response', () => {
    expect(parseReadResult(null)).toEqual({ shifts: [], warnings: [] });
    expect(parseReadResult({ shifts: 'x' })).toEqual({ shifts: [], warnings: [] });
  });

  it('ticks new valid shifts; leaves duplicates of saved shifts and invalid ones unticked; sorts and de-dupes', () => {
    const result: ReadResult = {
      warnings: [],
      shifts: [
        { date: '2026-10-08', start: '22:00', endDate: '2026-10-09', end: '06:00' }, // overnight, valid
        { date: '2026-10-06', start: '07:00', endDate: '2026-10-06', end: '15:00' }, // already saved
        { date: '2026-10-07', start: '15:00', endDate: '2026-10-07', end: '07:00' }, // ends before it starts
        { date: '2026-10-08', start: '22:00', endDate: '2026-10-09', end: '06:00' }, // repeated in the file
      ],
    };
    const rows = toCandidates(result, [saved]);
    expect(rows.map((r) => [r.input.date, r.keep, r.duplicate, !!r.error])).toEqual([
      ['2026-10-06', false, true, false],
      ['2026-10-07', false, false, true],
      ['2026-10-08', true, false, false],
    ]);
  });
});

describe('reading a schedule: talking to the server', () => {
  const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'sched.pdf', { type: 'application/pdf' });

  it('sends the file with the signed-in token and returns the parsed shifts', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ shifts: [{ date: '2026-10-07', start: '07:00', endDate: '2026-10-07', end: '15:00' }], warnings: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const read = createScheduleReader(async () => 'tok-123');
    const r = await read(pdf, 'Jay', '2026-10-03');
    expect(r.shifts).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/read-schedule');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-123');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ mediaType: 'application/pdf', memberName: 'Jay', today: '2026-10-03', file: btoa('%PDF') });
    vi.unstubAllGlobals();
  });

  it('refuses to call the server when signed out, and shows the server’s own error message', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'That file is too large.' }), { status: 413 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createScheduleReader(async () => null)(pdf, 'Jay', '2026-10-03')).rejects.toThrow(/signed out/);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(createScheduleReader(async () => 't')(pdf, 'Jay', '2026-10-03')).rejects.toThrow('That file is too large.');
    vi.unstubAllGlobals();
  });

  it('rejects files that are neither PDF nor image before uploading', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const doc = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await expect(createScheduleReader(async () => 't')(doc, 'Jay', '2026-10-03')).rejects.toThrow(/PDF or a photo/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('Upload a schedule sheet', () => {
  const result: ReadResult = {
    warnings: ['Oct 10 was smudged and was left out.'],
    shifts: [
      { date: '2026-10-07', start: '07:00', endDate: '2026-10-07', end: '15:00' },
      { date: '2026-10-08', start: '22:00', endDate: '2026-10-09', end: '06:00' },
    ],
  };

  async function upload(reader = vi.fn(async () => result), onSave = vi.fn(async () => true), onDone = vi.fn()) {
    const { container } = render(<ScheduleUpload reader={reader} memberName="Jay" existing={[saved]} now={new Date(2026, 9, 3)} onSave={onSave} onDone={onDone} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => void raw.change(input));
    await screen.findByText(/found 2 shifts/i);
    return { reader, onSave, onDone };
  }

  it('shows what was read with notes, saves nothing until Save, and saves only ticked shifts', async () => {
    const { reader, onSave, onDone } = await upload();
    expect(reader).toHaveBeenCalledWith(expect.any(File), 'Jay', '2026-10-03');
    expect(screen.getByText('Oct 10 was smudged and was left out.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    const boxes = screen.getAllByRole('checkbox');
    await fireEvent.click(boxes[0]!); // untick the first
    await fireEvent.click(screen.getByRole('button', { name: 'Save 1 shift' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-08', start: '22:00', endDate: '2026-10-09', end: '06:00', repeats: false }));
  });

  it('lets a shift be corrected before saving, and unticks it while it is invalid', async () => {
    const { onSave } = await upload();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    await fireEvent.change(screen.getByLabelText('End time'), { target: { value: '06:00' } });
    expect(screen.getByText(/must end after it starts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 1 shift' })).toBeInTheDocument();
    await fireEvent.change(screen.getByLabelText('End time'), { target: { value: '16:30' } });
    await fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await fireEvent.click(screen.getByRole('button', { name: 'Save 2 shifts' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-07', end: '16:30' }));
  });

  it('when a save fails, stops, keeps the unsaved shifts listed and says so', async () => {
    const onSave = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { onDone } = await upload(undefined, onSave);
    await fireEvent.click(screen.getByRole('button', { name: 'Save 2 shifts' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t save/);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('shows a reading error and lets the person try another file', async () => {
    const reader = vi.fn(async () => { throw new Error('The schedule reader is unavailable right now.'); });
    const { container } = render(<ScheduleUpload reader={reader} memberName="Jay" existing={[]} now={new Date(2026, 9, 3)} onSave={vi.fn()} onDone={vi.fn()} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.pdf', { type: 'application/pdf' })], configurable: true });
    await act(async () => void raw.change(input));
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable right now');
    expect(screen.getByRole('button', { name: 'Try another file' })).toBeInTheDocument();
  });
});
