import { describe, expect, it } from 'vitest'
import { distinct, EMPTY_FILTERS, filtersActive, matches, renderTemplate, sortComparator, type PhotoLike } from './filter'

const P = (o: Partial<PhotoLike> = {}): PhotoLike => ({
  name: 'IMG_001.jpg', rating: 0, flag: 'none', label: 'none', keywords: [], camera: '', lens: '', iso: null, capturedAt: null, addedAt: 1, hasEdits: false, ...o,
})

describe('filters', () => {
  it('empty filter matches everything and is inactive', () => {
    expect(matches(P(), EMPTY_FILTERS)).toBe(true)
    expect(filtersActive(EMPTY_FILTERS)).toBe(false)
  })
  it('filters by rating, flag, label', () => {
    expect(matches(P({ rating: 3 }), { ...EMPTY_FILTERS, minRating: 4 })).toBe(false)
    expect(matches(P({ rating: 4 }), { ...EMPTY_FILTERS, minRating: 4 })).toBe(true)
    expect(matches(P({ flag: 'pick' }), { ...EMPTY_FILTERS, flag: 'reject' })).toBe(false)
    expect(matches(P({ label: 'red' }), { ...EMPTY_FILTERS, labels: ['red', 'blue'] })).toBe(true)
  })
  it('filters by camera, ISO range and missing ISO', () => {
    const f = { ...EMPTY_FILTERS, isoMin: 100, isoMax: 800 }
    expect(matches(P({ iso: 400 }), f)).toBe(true)
    expect(matches(P({ iso: 1600 }), f)).toBe(false)
    expect(matches(P({ iso: null }), f)).toBe(false)
    expect(matches(P({ camera: 'A' }), { ...EMPTY_FILTERS, camera: 'B' })).toBe(false)
  })
  it('filters by date using capture time, falling back to import time', () => {
    const f = { ...EMPTY_FILTERS, dateFrom: 100, dateTo: 200 }
    expect(matches(P({ capturedAt: 150 }), f)).toBe(true)
    expect(matches(P({ capturedAt: null, addedAt: 500 }), f)).toBe(false)
  })
  it('keyword, edited and text search (all words, any field)', () => {
    expect(matches(P({ keywords: ['Beach', 'sunset'] }), { ...EMPTY_FILTERS, keyword: 'beach' })).toBe(true)
    expect(matches(P({ hasEdits: true }), { ...EMPTY_FILTERS, edited: 'no' })).toBe(false)
    const p = P({ name: 'trip.jpg', camera: 'Fuji X100', keywords: ['seoul'] })
    expect(matches(p, { ...EMPTY_FILTERS, text: 'fuji seoul' })).toBe(true)
    expect(matches(p, { ...EMPTY_FILTERS, text: 'fuji paris' })).toBe(false)
  })
})

describe('sorting', () => {
  const a = P({ name: 'img2.jpg', rating: 1, capturedAt: 30 })
  const b = P({ name: 'img10.jpg', rating: 5, capturedAt: 10 })
  const c = P({ name: 'img1.jpg', rating: 3, capturedAt: 20 })
  it('natural name order', () => {
    expect([a, b, c].sort(sortComparator('name', 'asc')).map((p) => p.name)).toEqual(['img1.jpg', 'img2.jpg', 'img10.jpg'])
  })
  it('capture time and rating, both directions', () => {
    expect([a, b, c].sort(sortComparator('capture', 'asc')).map((p) => p.capturedAt)).toEqual([10, 20, 30])
    expect([a, b, c].sort(sortComparator('rating', 'desc')).map((p) => p.rating)).toEqual([5, 3, 1])
  })
  it('distinct values by frequency', () => {
    expect(distinct(['a', 'b', 'b', '', 'c', 'b', 'a'])).toEqual(['b', 'a', 'c'])
  })
})

describe('renderTemplate', () => {
  const ctx = { name: 'DSC_0042.JPG', seq: 7, date: new Date(2025, 4, 3).getTime(), rating: 4, camera: 'Sony A7' }
  it('fills tokens (English and Korean aliases)', () => {
    expect(renderTemplate('{name}_{seq3}', ctx)).toBe('DSC_0042_007')
    expect(renderTemplate('{원본명}_{순번}', ctx)).toBe('DSC_0042_7')
    expect(renderTemplate('{date}-{camera}', ctx)).toBe('20250503-Sony-A7')
  })
  it('keeps unknown tokens, sanitises path characters, never returns empty', () => {
    expect(renderTemplate('{x}/{name}', ctx)).toBe('{x}_DSC_0042')
    expect(renderTemplate('   ', ctx)).toBe('DSC_0042')
  })
})
