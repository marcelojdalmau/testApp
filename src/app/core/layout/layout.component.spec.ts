import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LayoutComponent } from './layout.component';

/**
 * Example tests for the layout navigation configuration.
 *
 * Validates:
 * - Requirement 1.1: desktop sidebar excludes the marketplace entry.
 * - Requirement 1.2: mobile bottom navigation excludes the marketplace entry.
 * - Requirement 1.4: no navigation control targets /marketplace.
 * - Requirement 3.6: the management entry is a link to /management.
 */
describe('LayoutComponent navigation', () => {
  let component: LayoutComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([]), provideNoopAnimations()],
    });

    component = TestBed.createComponent(LayoutComponent).componentInstance;
  });

  it('excludes the /marketplace entry from the desktop sidebar navItems (1.1, 1.4)', () => {
    const marketplaceEntries = component.navItems().filter(item => item.route === '/marketplace');
    expect(marketplaceEntries.length).toBe(0);
  });

  it('excludes the /marketplace entry from the mobile bottomNavItems (1.2, 1.4)', () => {
    const marketplaceEntries = component.bottomNavItems.filter(item => item.route === '/marketplace');
    expect(marketplaceEntries.length).toBe(0);
  });

  it('presents the management navigation entry as a link to /management (3.6)', () => {
    // With no signed-in athlete in the test, the role resolves to a non-athlete
    // workspace, so the sidebar surfaces the /management entry.
    const managementEntry = component.navItems().find(item => item.route === '/management');
    expect(managementEntry).toBeTruthy();
    expect(managementEntry?.route).toBe('/management');
  });
});
