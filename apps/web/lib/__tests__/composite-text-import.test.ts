import { mapCompositeTextSubField, mapContactFullName } from '../composite-text-import'

describe('Composite Text imports', () => {
  it('maps a subfield to the nested parent and flat API aliases', () => {
    expect(mapCompositeTextSubField('Contact', 'name::Contact__name_firstName', 'Ada')).toEqual({
      Contact__name_firstName: 'Ada',
      Contact__name: { Contact__name_firstName: 'Ada' },
      Contact__firstName: 'Ada',
    })
  })

  it('splits a Contact full name into first and last name subfields', () => {
    expect(mapContactFullName('Ada Lovelace')).toEqual({
      Contact__name_firstName: 'Ada',
      Contact__name: {
        Contact__name_firstName: 'Ada',
        Contact__name_lastName: 'Lovelace',
      },
      Contact__firstName: 'Ada',
      Contact__name_lastName: 'Lovelace',
      Contact__lastName: 'Lovelace',
    })
  })

  it('supports single-word names and ignores blank subfield values', () => {
    expect(mapContactFullName('Cher')).toEqual({
      Contact__name_firstName: 'Cher',
      Contact__name: { Contact__name_firstName: 'Cher' },
      Contact__firstName: 'Cher',
    })
    expect(mapCompositeTextSubField('Contact', 'name::Contact__name_firstName', ' ')).toBeNull()
  })
})