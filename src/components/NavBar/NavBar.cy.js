import NavBar from './NavBar.vue';
import { APP_ROUTES } from '../../constants/routes';
import overrideLogo from '../../../public/LEVANTE/Levante_Logo.png';

const MOCK_USERNAME = 'Test User';
const MOCK_MENU_ITEMS = [
  {
    label: 'Administrations',
    items: [
      { label: 'View all', icon: 'pi pi-list' },
      { label: 'Add administration', icon: 'pi pi-plus' },
    ],
  },
  {
    label: 'Organisations',
    items: [
      { label: 'View organisations', icon: 'pi pi-list' },
      { label: 'Add organisation', icon: 'pi pi-plus' },
    ],
  },
];

describe('<NavBar />', () => {
  describe('Desktop', () => {
    it('Renders the default component', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
        },
      });

      cy.get('nav').should('exist');
      cy.get('[data-cy="navbar__logo"]').should('be.visible');
      cy.get('[data-cy="navbar__display-name"]').should('be.visible').contains(MOCK_USERNAME);
      cy.get('[data-cy="navbar__signout-btn-mobile"]').should('not.exist');
      cy.get('[data-cy="navbar__signout-btn-desktop"]').should('be.visible').contains('Sign Out');
      cy.get('[data-cy="navbar__account-settings-btn"]').should('be.visible');
    });

    it('Renders the menu items', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
        },
      });

      cy.get('nav').should('exist');
      cy.get('.p-menubar-root-list > .p-menuitem').should('have.length', MOCK_MENU_ITEMS.length);

      MOCK_MENU_ITEMS.forEach((menuItem, index) => {
        // Check if the menu item is rendered correctly.
        cy.get(`.p-menubar-root-list > .p-menuitem:nth-child(${index + 1})`).as('menuItemEl');
        cy.get('@menuItemEl').should('contain', menuItem.label).click();
        cy.get('@menuItemEl')
          .find('.p-submenu-list')
          .should('be.visible')
          .within(() => {
            // Count the number of submenu items.
            cy.get('.p-menuitem').should('have.length', menuItem.items.length);

            // Validate each submenu item.
            menuItem.items.forEach((subMenuItem, subIndex) => {
              const iconClassSelector = subMenuItem.icon
                ? [...subMenuItem.icon.split(' ').map((cls) => `.${cls}`)].join('')
                : '';

              cy.get(`.p-menuitem:nth-child(${subIndex + 1})`)
                .should('contain', subMenuItem.label)
                .find(`.p-menuitem-icon${iconClassSelector}`)
                .should('exist');
            });
          });

        // Close the menu item.
        cy.get(`.p-menubar-root-list > .p-menuitem:nth-child(${index + 1})`).click();
      });
    });

    it('Renders without account settings button', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
          showAccountSettingsLink: false,
        },
      });

      cy.get('nav').should('exist');
      cy.get('[data-cy="navbar__account-settings-btn"]').should('not.exist');
    });

    it('Renders with a logo override', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
          logo: overrideLogo,
        },
      });

      cy.get('nav').should('exist');
      cy.get('[data-cy="navbar__logo"]').find('img').should('be.visible').should('have.attr', 'src', overrideLogo);
    });

    it('Allows users to navigate to the homepage', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
        },
      });

      cy.get('[data-cy="navbar__logo"]').should('be.visible').should('have.attr', 'href', '/');
    });

    it('Allows users to navigate using the menu item dropdowns', () => {
      const menuItemSpy = cy.spy().as('menuItemSpy');

      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: [
            {
              label: 'Administrations',
              items: [
                {
                  label: 'View all',
                  icon: 'pi pi-list',
                  command: menuItemSpy,
                },
              ],
            },
          ],
        },
      });

      cy.get('.p-menubar-root-list > .p-menuitem').as('menuItemEl');
      cy.get('@menuItemEl').should('contain', 'Administrations').click();
      cy.get('@menuItemEl')
        .find('.p-submenu-list')
        .should('be.visible')
        .within(() => {
          cy.get('.p-menuitem').should('have.length', 1).first().should('be.visible').click();
          cy.get('@menuItemSpy').should('have.been.calledOnce');
        });
    });

    it('Allows users to navigate to their account settings', () => {
      cy.mount(NavBar, {
        props: {
          displayName: MOCK_USERNAME,
          menuItems: MOCK_MENU_ITEMS,
        },
      });

      cy.get('[data-cy="navbar__account-settings-btn"]')
        .should('be.visible')
        .should('have.attr', 'href', APP_ROUTES.ACCOUNT_PROFILE);
    });

    it('Allows user to sign-out', () => {
      const onSignOutSpy = cy.spy().as('onSignOutSpy');

      cy.mount(NavBar, {
        props: {
          displayName: 'Test User',
          menuItems: MOCK_MENU_ITEMS,
          onSignOut: onSignOutSpy,
        },
      });

      cy.get('nav').should('exist');
      cy.get('[data-cy="navbar__signout-btn-desktop"]').should('be.visible').click();
      cy.get('@onSignOutSpy').should('have.been.calledOnce');
    });
  });
});
