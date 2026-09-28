import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Placeholder para la página de completar perfil (ruta `/profile/complete`).
 *
 * El contenido del formulario de completar perfil queda fuera del alcance del
 * spec `register-reform`: aquí solo se define el destino de navegación al que
 * se dirige a un usuario autenticado con el perfil incompleto (Req 6.2).
 */
@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="complete-profile">
      <h1>Completa tu perfil</h1>
      <p>Necesitamos algunos datos más para terminar de configurar tu cuenta.</p>
    </section>
  `,
})
export class CompleteProfileComponent {}
