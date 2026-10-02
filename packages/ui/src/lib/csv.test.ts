import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, parseCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('quotes every cell, doubles quotes, blanks nullish, joins rows with CRLF', () => {
    expect(toCsv([['a', 1, null], ['say "hi"', undefined, 'x,y']])).toBe('"a","1",""\r\n"say ""hi""","","x,y"')
  })
})

describe('parseCsv', () => {
  it('parses plain rows and trims cells', () => {
    expect(parseCsv('a, b ,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('handles quoted commas, doubled quotes and embedded line breaks', () => {
    expect(parseCsv('"x,y","say ""hi""","two\nlines"')).toEqual([['x,y', 'say "hi"', 'two\nlines']])
  })
  it('accepts CRLF and lone CR line endings', () => {
    expect(parseCsv('a,b\r\nc,d\re,f\r\n')).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f']])
  })
  it('strips a leading BOM', () => {
    expect(parseCsv('﻿name\nAli')).toEqual([['name'], ['Ali']])
  })
  it('drops blank lines, including rows of empty cells', () => {
    expect(parseCsv('\n\na\n\n , \nb\n')).toEqual([['a'], ['b']])
    expect(parseCsv('')).toEqual([])
  })
  it('round-trips toCsv output', () => {
    const rows = [['Name', 'Note'], ['ޢަލީ', 'a "b", c']]
    expect(parseCsv('﻿' + toCsv(rows))).toEqual(rows)
  })
})

describe('downloadCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('clicks a BOM-prefixed blob link and revokes it later', async () => {
    vi.useFakeTimers()
    const a = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => a) })
    const revoke = vi.fn()
    let blob: Blob | undefined
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => ((blob = b), 'blob:1'), revokeObjectURL: revoke })

    downloadCsv('people.csv', [['a']])
    expect(a.download).toBe('people.csv')
    expect(a.href).toBe('blob:1')
    expect(a.click).toHaveBeenCalledOnce()
    expect(blob?.type).toBe('text/csv;charset=utf-8')
    expect(new Uint8Array(await blob!.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })

  it('fails quietly when the download is blocked', () => {
    vi.stubGlobal('document', { createElement: () => { throw new Error('blocked') } })
    expect(() => downloadCsv('x.csv', [])).not.toThrow()
  })
})
