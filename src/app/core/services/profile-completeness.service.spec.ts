import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { PROFILE_REQUIRED_FIELDS, RequiredFieldPath } from '../config/profile.config';
import { UserProfileDto } from '../models/user-profile-dto.model';
import { ProfileCompletenessService } from './profile-completeness.service';

/**
 * Property-based tests for ProfileCompletenessService (Completeness_Resolver).
 *
 * Feature: register-reform, Property 2: La precedencia de la bandera de completitud
 * es determinista.
 *
 * Para todo perfil y para todo valor de bandera que sea booleano,
 * `resolve()` clasifica según la bandera (`true` → complete, `false` →
 * incomplete), independientemente del contenido del perfil.
 *
 * Validates: Requirements 5.1
 */
describe('Feature: register-reform, Property 2: La precedencia de la bandera de completitud es determinista', () => {
  const freshService = (): ProfileCompletenessService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ProfileCompletenessService);
  };

  /** An arbitrary ProfileAttachment (may be present or partially filled). */
  const attachmentArb: fc.Arbitrary<{ fileName: string; url: string; mimeType?: string }> =
    fc.record(
      {
        fileName: fc.string(),
        url: fc.string(),
        mimeType: fc.string(),
      },
      { requiredKeys: ['fileName', 'url'] },
    );

  /**
   * An arbitrary `common` block whose required fields may be present, absent,
   * empty or nullish. This deliberately spans complete and incomplete profiles
   * so the property holds regardless of profile content.
   */
  const commonBlockArb: fc.Arbitrary<Record<string, unknown>> = fc.record(
    {
      visibleInMarketplace: fc.boolean(),
      profilePhoto: attachmentArb,
      email: fc.oneof(fc.string(), fc.constant(''), fc.constant(null), fc.constant(undefined)),
      firstName: fc.oneof(fc.string(), fc.constant(''), fc.constant(null)),
      lastName: fc.oneof(fc.string(), fc.constant('')),
      birthDate: fc.oneof(fc.date(), fc.constant(null), fc.constant(undefined)),
      identityDocumentNumber: fc.oneof(fc.string(), fc.constant('')),
      documentTypeId: fc.oneof(fc.string(), fc.constant('')),
      idCardVerification: fc.oneof(attachmentArb, fc.constant(null)),
      nationalityId: fc.oneof(fc.string(), fc.constant('')),
      sexId: fc.oneof(fc.string(), fc.constant('')),
      personTypeId: fc.oneof(fc.string(), fc.constant('')),
    },
    { requiredKeys: [] },
  );

  /**
   * An arbitrary UserProfileDto-like profile. The `common` block is sometimes
   * present (partial/complete) and sometimes entirely absent so profile content
   * varies fully across runs.
   */
  const profileArb: fc.Arbitrary<UserProfileDto> = fc
    .record(
      {
        id: fc.string(),
        common: fc.oneof(commonBlockArb, fc.constant(undefined)),
      },
      { requiredKeys: ['id'] },
    )
    .map((obj) => obj as unknown as UserProfileDto);

  it('classifies as complete for any profile when the flag is boolean true', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const service = freshService();
        const result = service.resolve(profile, true);
        expect(result.status).toBe('complete');
        expect(result.errored).toBeFalse();
      }),
      { numRuns: 100 },
    );
  });

  it('classifies as incomplete for any profile when the flag is boolean false', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const service = freshService();
        const result = service.resolve(profile, false);
        expect(result.status).toBe('incomplete');
        expect(result.errored).toBeFalse();
      }),
      { numRuns: 100 },
    );
  });

  it('classifies deterministically by the boolean flag regardless of profile content', () => {
    fc.assert(
      fc.property(profileArb, fc.boolean(), (profile, flag) => {
        const service = freshService();
        const result = service.resolve(profile, flag);
        expect(result.status).toBe(flag ? 'complete' : 'incomplete');
        expect(result.errored).toBeFalse();
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: register-reform, Property 3: El respaldo por campos requeridos es correcto
 *
 * Para todo perfil y para toda bandera que NO sea booleana (ausente, nula o de
 * otro tipo), resolve() clasifica como 'complete' si y solo si todos los campos
 * de PROFILE_REQUIRED_FIELDS están presentes (no nulos y distintos de cadena
 * vacía; objeto no vacío), y como 'incomplete' si al menos uno está ausente.
 *
 * Validates: Requirements 5.2, 5.3, 5.4
 */
describe('Feature: register-reform, Property 3: El respaldo por campos requeridos es correcto', () => {
  const freshService = (): ProfileCompletenessService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ProfileCompletenessService);
  };

  /**
   * The default required-field paths (all under the `common` block). Mirrors the
   * PROFILE_REQUIRED_FIELDS token default; a guard test below asserts the injected
   * set matches these paths so the oracle cannot drift silently.
   */
  const REQUIRED_FIELD_PATHS: RequiredFieldPath[] = [
    'common.profilePhoto',
    'common.email',
    'common.firstName',
    'common.lastName',
    'common.birthDate',
    'common.identityDocumentNumber',
    'common.documentTypeId',
    'common.idCardVerification',
    'common.nationalityId',
    'common.sexId',
    'common.personTypeId',
  ];

  /** The leaf keys of the `common` block that are required fields (all live under `common.`). */
  const REQUIRED_COMMON_KEYS: string[] = REQUIRED_FIELD_PATHS.map((path) => path.split('.')[1]);

  it('uses the same required-field set that the resolver injects', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const injected = TestBed.inject(PROFILE_REQUIRED_FIELDS);
    expect(injected).toEqual(REQUIRED_FIELD_PATHS);
  });

  /** Object-shaped required fields (attachments). */
  const attachmentKeys = new Set(['profilePhoto', 'idCardVerification']);

  /**
   * A per-field decision: whether the field is intended to be "present" and the
   * concrete value used. Carrying `present` lets the oracle avoid re-deriving
   * the isPresent semantics from the value.
   */
  interface FieldChoice {
    present: boolean;
    value: unknown;
  }

  /** A value that the resolver treats as present for the given key. */
  const presentValueArb = (key: string): fc.Arbitrary<unknown> => {
    if (attachmentKeys.has(key)) {
      // Non-empty object => present (Object.keys(value).length > 0).
      return fc.record({
        fileName: fc.string({ minLength: 1, maxLength: 20 }),
        url: fc.string({ minLength: 1, maxLength: 40 }),
      });
    }
    if (key === 'birthDate') {
      // A Date is a non-null object with own keys => present.
      return fc.date({ noInvalidDate: true });
    }
    // Non-blank string => present (value.trim().length > 0).
    return fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);
  };

  /** A value that the resolver treats as absent for the given key. */
  const absentValueArb = (key: string): fc.Arbitrary<unknown> => {
    if (attachmentKeys.has(key)) {
      // null or empty object are both absent for object fields.
      return fc.oneof(fc.constant(null), fc.constant({}));
    }
    if (key === 'birthDate') {
      // For a Date field, absent means null.
      return fc.constant(null);
    }
    // null or blank string are absent for string fields.
    return fc.oneof(fc.constant(null), fc.constant(''), fc.constant('   '));
  };

  /** Choice arbitrary for a single required key (present or absent). */
  const fieldChoiceArb = (key: string): fc.Arbitrary<FieldChoice> =>
    fc
      .boolean()
      .chain((present) =>
        (present ? presentValueArb(key) : absentValueArb(key)).map((value) => ({ present, value })),
      );

  /** Per-field choices covering the whole required set (partial/complete `common`). */
  const commonChoicesArb: fc.Arbitrary<Record<string, FieldChoice>> = fc.record(
    Object.fromEntries(REQUIRED_COMMON_KEYS.map((key) => [key, fieldChoiceArb(key)])),
  );

  /** Non-boolean flags: null, undefined, numbers, strings. */
  const nonBooleanFlagArb: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer(),
    fc.double({ noNaN: true }),
    fc.string(),
  );

  it('classifies complete iff every required field is present, for any non-boolean flag', () => {
    fc.assert(
      fc.property(commonChoicesArb, nonBooleanFlagArb, (choices, flag) => {
        const common: Record<string, unknown> = {};
        for (const key of REQUIRED_COMMON_KEYS) {
          common[key] = choices[key].value;
        }
        const profile = { id: 'p-1', common } as unknown as UserProfileDto;

        // Oracle: complete iff every required field was chosen present.
        const expectedComplete = REQUIRED_COMMON_KEYS.every((key) => choices[key].present);

        const service = freshService();
        const result = service.resolve(profile, flag);

        expect(result.errored).toBeFalse();
        expect(result.status).toBe(expectedComplete ? 'complete' : 'incomplete');
      }),
      { numRuns: 200 },
    );
  });

  it('classifies incomplete when the common block is missing entirely, for any non-boolean flag', () => {
    fc.assert(
      fc.property(nonBooleanFlagArb, (flag) => {
        const profile = { id: 'p-1' } as unknown as UserProfileDto;
        const service = freshService();
        const result = service.resolve(profile, flag);
        expect(result.errored).toBeFalse();
        expect(result.status).toBe('incomplete');
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: register-reform, Property 4: Los campos opcionales no afectan la completitud
 *
 * Para todo perfil cuyos campos requeridos (PROFILE_REQUIRED_FIELDS) están
 * todos presentes, resolve() por el camino de respaldo (bandera NO booleana)
 * lo clasifica como 'complete' sin importar el estado de cualquier campo
 * opcional del UserProfileDto (campos opcionales del bloque `common` presentes,
 * ausentes o vacíos, y bloques de persona opcionales presentes o ausentes).
 *
 * Validates: Requirements 5.5
 */
describe('Feature: register-reform, Property 4: Los campos opcionales no afectan la completitud', () => {
  const freshService = (): ProfileCompletenessService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ProfileCompletenessService);
  };

  /** Required-field paths, mirrored from the PROFILE_REQUIRED_FIELDS default. */
  const REQUIRED_FIELD_PATHS: RequiredFieldPath[] = [
    'common.profilePhoto',
    'common.email',
    'common.firstName',
    'common.lastName',
    'common.birthDate',
    'common.identityDocumentNumber',
    'common.documentTypeId',
    'common.idCardVerification',
    'common.nationalityId',
    'common.sexId',
    'common.personTypeId',
  ];

  it('injects the same required-field set the resolver uses', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const injected = TestBed.inject(PROFILE_REQUIRED_FIELDS);
    expect(injected).toEqual(REQUIRED_FIELD_PATHS);
  });

  /** A present (non-empty) attachment value. */
  const presentAttachmentArb: fc.Arbitrary<{ fileName: string; url: string }> = fc.record({
    fileName: fc.string({ minLength: 1, maxLength: 20 }),
    url: fc.string({ minLength: 1, maxLength: 40 }),
  });

  /** A present (non-blank) string value. */
  const presentStringArb: fc.Arbitrary<string> = fc
    .string({ minLength: 1, maxLength: 30 })
    .filter((s) => s.trim().length > 0);

  /**
   * A `common` block whose required fields are ALWAYS present, so the profile is
   * necessarily complete via the fallback path. Optional `common` fields are
   * left to `requiredCommonArb`'s caller to attach.
   */
  const requiredCommonArb: fc.Arbitrary<Record<string, unknown>> = fc.record({
    profilePhoto: presentAttachmentArb,
    email: presentStringArb,
    firstName: presentStringArb,
    lastName: presentStringArb,
    birthDate: fc.date({ noInvalidDate: true }),
    identityDocumentNumber: presentStringArb,
    documentTypeId: presentStringArb,
    idCardVerification: presentAttachmentArb,
    nationalityId: presentStringArb,
    sexId: presentStringArb,
    personTypeId: presentStringArb,
  });

  /**
   * Arbitrary optional fields for the `common` block. Each may be present,
   * absent, empty or nullish — none of them are required, so completeness must
   * not depend on them.
   */
  const optionalCommonFieldsArb: fc.Arbitrary<Record<string, unknown>> = fc.record(
    {
      visibleInMarketplace: fc.boolean(),
      address: fc.oneof(fc.string(), fc.constant(''), fc.constant(null), fc.constant(undefined)),
      postalCode: fc.oneof(fc.string(), fc.constant(''), fc.constant(null)),
      city: fc.oneof(fc.string(), fc.constant('')),
      province: fc.oneof(fc.string(), fc.constant(null)),
      country: fc.oneof(fc.string(), fc.constant('')),
      phone: fc.oneof(fc.string(), fc.constant(''), fc.constant(undefined)),
    },
    { requiredKeys: [] },
  );

  /**
   * Arbitrary optional persona blocks at the root of the DTO (all optional).
   * Each block may be present (as an arbitrary object) or entirely absent.
   */
  const optionalPersonaBlocksArb: fc.Arbitrary<Record<string, unknown>> = fc.record(
    {
      naturalPerson: fc.oneof(
        fc.record({ hobbies: fc.array(fc.string()) }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      healthProfessional: fc.oneof(
        fc.record({ isLicensed: fc.boolean() }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      athlete: fc.oneof(
        fc.record({ sports: fc.array(fc.record({ sportType: fc.string() })) }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      anatomical: fc.oneof(
        fc.record({ weight: fc.integer(), height: fc.integer() }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      club: fc.oneof(
        fc.record({ name: fc.string() }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      manager: fc.oneof(
        fc.record({ representedPlayerCount: fc.integer() }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
      tutor: fc.oneof(fc.record({}, { requiredKeys: [] }), fc.constant(undefined)),
      clubWorker: fc.oneof(
        fc.record({ workArea: fc.string() }, { requiredKeys: [] }),
        fc.constant(undefined),
      ),
    },
    { requiredKeys: [] },
  );

  /** Non-boolean flags force the fallback (required-fields) path. */
  const nonBooleanFlagArb: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer(),
    fc.double({ noNaN: true }),
    fc.string(),
  );

  it('always classifies complete when all required fields are present, regardless of optional fields', () => {
    fc.assert(
      fc.property(
        requiredCommonArb,
        optionalCommonFieldsArb,
        optionalPersonaBlocksArb,
        nonBooleanFlagArb,
        (required, optionalCommon, personaBlocks, flag) => {
          // Merge optional common fields onto the always-present required ones.
          const common = { ...optionalCommon, ...required };
          const profile = {
            id: 'p-1',
            common,
            ...personaBlocks,
          } as unknown as UserProfileDto;

          const service = freshService();
          const result = service.resolve(profile, flag);

          expect(result.errored).toBeFalse();
          expect(result.status).toBe('complete');
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: register-reform, Property 6: El fallo de resolución degrada de forma segura
 *
 * Para toda evaluación de completitud que falle por una excepción interna,
 * resolve() devuelve { status: 'incomplete', errored: true } y no muta el
 * perfil recibido.
 *
 * La bandera debe ser no booleana para forzar el respaldo por
 * PROFILE_REQUIRED_FIELDS, que es donde ocurre la travesía del perfil; un getter
 * que lanza a lo largo de una ruta requerida provoca la excepción interna que la
 * cláusula catch de resolve() debe degradar de forma segura.
 *
 * Validates: Requirements 5.7, 6.5
 */
describe('Feature: register-reform, Property 6: El fallo de resolución degrada de forma segura', () => {
  /**
   * Crea un servicio cuyo conjunto de campos requeridos incluye `throwingPath`,
   * de modo que la travesía de ese campo dispare la excepción inyectada.
   */
  const freshServiceWithFields = (fields: RequiredFieldPath[]): ProfileCompletenessService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PROFILE_REQUIRED_FIELDS, useValue: fields }],
    });
    return TestBed.inject(ProfileCompletenessService);
  };

  /** Banderas no booleanas: fuerzan el respaldo por campos requeridos (donde se recorre el perfil). */
  const nonBooleanFlagArb: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer(),
    fc.double({ noNaN: true }),
    fc.string(),
  );

  /** Nombre de una clave hoja arbitraria bajo `common` que llevará un getter que lanza. */
  const throwingKeyArb: fc.Arbitrary<string> = fc
    .string({ minLength: 1, maxLength: 15 })
    .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

  /**
   * Construye un perfil con un getter que lanza en `common[key]` y captura una
   * instantánea profunda de las propiedades enumerables (sin invocar el getter)
   * para comparar tras la resolución.
   */
  const buildThrowingProfile = (
    key: string,
  ): { profile: UserProfileDto; snapshot: string } => {
    const common: Record<string, unknown> = {
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    Object.defineProperty(common, key, {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('boom: resolución de campo requerido falló');
      },
    });
    const profile = { id: 'p-err', common } as unknown as UserProfileDto;
    // Instantánea de las claves no explosivas para verificar ausencia de mutación.
    const snapshot = JSON.stringify({ id: 'p-err', commonKeys: Object.keys(common).sort() });
    return { profile, snapshot };
  };

  it('degrada a incomplete con errored=true cuando la travesía lanza, sin mutar el perfil', () => {
    fc.assert(
      fc.property(throwingKeyArb, nonBooleanFlagArb, (key, flag) => {
        const { profile, snapshot } = buildThrowingProfile(key);
        // El campo que lanza forma parte del conjunto requerido, garantizando la travesía.
        const service = freshServiceWithFields([`common.${key}`]);

        const result = service.resolve(profile, flag);

        expect(result.status).toBe('incomplete');
        expect(result.errored).toBeTrue();

        // El perfil no fue mutado: mismas claves enumerables antes y después.
        const common = (profile as unknown as { common: Record<string, unknown> }).common;
        const after = JSON.stringify({
          id: (profile as unknown as { id: string }).id,
          commonKeys: Object.keys(common).sort(),
        });
        expect(after).toBe(snapshot);
        // El getter sigue lanzando (no fue reemplazado ni cacheado).
        expect(() => common[key]).toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it('preserva el DTO intacto ante fallo para cualquier bandera no booleana', () => {
    fc.assert(
      fc.property(nonBooleanFlagArb, (flag) => {
        const { profile } = buildThrowingProfile('birthDate');
        const service = freshServiceWithFields(['common.birthDate']);

        const result = service.resolve(profile, flag);

        expect(result.status).toBe('incomplete');
        expect(result.errored).toBeTrue();
        // Las claves seguras conservan sus valores originales; el perfil no se mutó.
        const common = (profile as unknown as { common: Record<string, unknown> }).common;
        expect(common['firstName']).toBe('Ada');
        expect(common['lastName']).toBe('Lovelace');
      }),
      { numRuns: 100 },
    );
  });
});
