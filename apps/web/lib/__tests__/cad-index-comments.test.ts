import { parseCadIndexComments } from '../cad-index-comments'

describe('CAD Index comments', () => {
  it('keeps separate comments per report', () => {
    expect(parseCadIndexComments(JSON.stringify({ Survey: 'Check openings', Progress: 'Week 2' }))).toEqual({
      Survey: 'Check openings', Progress: 'Week 2',
    })
  })

  it('ignores malformed and non-text values', () => {
    expect(parseCadIndexComments('{broken')).toEqual({})
    expect(parseCadIndexComments({ Survey: 'Notes', Other: 12 })).toEqual({ Survey: 'Notes' })
  })
})