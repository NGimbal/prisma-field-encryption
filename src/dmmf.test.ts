import { getDMMF } from '@prisma/sdk'
import { analyseDMMF, DMMFAnalysis, parseAnnotation } from './dmmf'

describe('dmmf', () => {
  describe('parseAnnotation', () => {
    test('no annotation at all', () => {
      const received = parseAnnotation()
      const expected = null
      expect(received).toEqual(expected)
    })

    test('no @encrypted keyword', () => {
      const received = parseAnnotation('not encrypted')
      const expected = null
      expect(received).toEqual(expected)
    })

    test('@encrypted keyword alone', () => {
      const received = parseAnnotation(' pre @encrypted post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?with=junk', () => {
      const received = parseAnnotation(' pre @encrypted?with=junk post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('@encrypted?strict', () => {
      const received = parseAnnotation(' pre @encrypted?strict post ')
      expect(received!.encrypt).toEqual(true)
      expect(received!.strictDecryption).toEqual(true)
    })

    test('@encrypted?readonly', () => {
      const received = parseAnnotation(' pre @encrypted?readonly post ')
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })

    test('readonly takes precedence over strict', () => {
      const received = parseAnnotation(' pre @encrypted?strict&readonly post ')
      expect(received!.encrypt).toEqual(false)
      expect(received!.strictDecryption).toEqual(false)
    })
  })

  test('analyseDMMF', async () => {
    const dmmf = await getDMMF({
      datamodel: `
        model User {
          id           Int     @id @default(autoincrement())
          email        String  @unique
          name         String? /// @encrypted
          posts        Post[]
          pinnedPost   Post?   @relation(fields: [pinnedPostId], references: [id], name: "pinnedPost")
          pinnedPostId Int?
        }

        model Post {
          id         Int        @id @default(autoincrement())
          title      String
          content    String? /// @encrypted
          author     User?      @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
          authorId   Int?
          categories Category[]
          havePinned User[]     @relation("pinnedPost")
        }

        // Model without encrypted fields
        model Category {
          id    Int    @id @default(autoincrement())
          name  String
          posts Post[]
        }
      `
    })
    const received = analyseDMMF(dmmf)
    const expected: DMMFAnalysis = {
      models: [
        {
          name: { titleCase: 'User', lowercase: 'user', plural: 'users' },
          fields: { name: { encrypt: true, strictDecryption: false } },
          connections: {
            Post: [
              { name: 'posts', isList: true },
              { name: 'pinnedPost', isList: false }
            ]
          }
        },
        {
          name: { titleCase: 'Post', lowercase: 'post', plural: 'posts' },
          fields: { content: { encrypt: true, strictDecryption: false } },
          connections: {
            User: [
              { name: 'author', isList: false },
              { name: 'havePinned', isList: true }
            ]
          }
        }
      ]
    }
    expect(received).toEqual(expected)
  })
})
