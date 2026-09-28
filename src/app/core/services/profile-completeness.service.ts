import { inject, Injectable } from '@angular/core';

import { PROFILE_REQUIRED_FIELDS, RequiredFieldPath } from '../config/profile.config';
import { UserProfileDto } from '../models/user-profile-dto.model';

/** Clasificación de la completitud de un perfil (Req 5). */
export type Completeness = 'complete' | 'incomplete';

/**
 * Resultado de resolver la completitud de un perfil.
 *
 * `errored` es `true` cuando la evaluación falló y se degradó de forma segura a
 * `incomplete` (Req 5.7).
 */
export interface CompletenessResult {
  status: Completeness;
  errored: boolean;
}

/**
 * Completeness_Resolver: decide si un perfil está completo (Req 5).
 *
 * Precedencia: se prefiere la `Profile_Completeness_Flag` del backend cuando es
 * booleana (Req 5.1); en su ausencia, nulo o valor no booleano, se recurre al
 * cálculo por `PROFILE_REQUIRED_FIELDS` (Req 5.2). La evaluación es síncrona y
 * acotada (≤200ms, Req 5.6) y nunca muta el perfil recibido.
 */
@Injectable({ providedIn: 'root' })
export class ProfileCompletenessService {
  private readonly requiredFields = inject(PROFILE_REQUIRED_FIELDS);

  /**
   * Resuelve la completitud del perfil.
   *
   * @param profile Perfil del usuario autenticado (nunca se muta).
   * @param flag Bandera de completitud del backend; solo se usa si es booleana.
   * @returns La clasificación y si la evaluación degradó por error (Req 5.7).
   */
  resolve(profile: UserProfileDto, flag: unknown): CompletenessResult {
    try {
      // Req 5.1: preferir la bandera del backend cuando es booleana.
      if (typeof flag === 'boolean') {
        return { status: flag ? 'complete' : 'incomplete', errored: false };
      }
      // Req 5.2: respaldo por Required_Fields cuando la bandera está ausente/null/no booleana.
      const allPresent = this.requiredFields.every((path) => this.isPresent(profile, path));
      return { status: allPresent ? 'complete' : 'incomplete', errored: false };
    } catch {
      // Req 5.7: ante fallo, clasificar Incomplete y señalar error, preservando el DTO.
      return { status: 'incomplete', errored: true };
    }
  }

  /**
   * Determina si el campo referenciado por `path` está presente en el perfil.
   *
   * Presente = valor no nulo y distinto de cadena vacía (Req 5.3). Para objetos
   * (p. ej. `profilePhoto`) se considera presente si el objeto existe y no está
   * vacío. Ausente = nulo o cadena vacía (Req 5.4).
   */
  private isPresent(profile: UserProfileDto, path: RequiredFieldPath): boolean {
    const value = path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc != null && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[key]
            : undefined,
        profile,
      );
    if (value === null || value === undefined) return false; // Req 5.3, 5.4
    if (typeof value === 'string') return value.trim().length > 0;
    // Una fecha válida cuenta como presente aunque no tenga claves propias
    // enumerables (`Object.keys(new Date()).length === 0`). Req 5.3.
    if (value instanceof Date) return !isNaN(value.getTime());
    // Otros objetos (p. ej. adjuntos): presentes si existen y no están vacíos.
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true; // primitivos restantes (number, boolean)
  }
}
