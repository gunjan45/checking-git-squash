import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "@flare/primitives/core-ui";
import { mockCsodGlobal } from "@flare/core-utils/testing";
import {
  render,
  screen,
  fireEvent,
  act,
  within,
  waitFor,
} from "@testing-library/react";
import ManageGroups from "pages/ManageGroups";
import { Keys } from "localizations";
import { ManageGroupTabs, SessionKeys } from "common/constants";
import { GroupAdminSettingsContext } from "common/contexts";
import { userEvent } from "@testing-library/user-event";
import { mockSettings } from "mocks/mockSettings";
import { mockGroupsGet } from "../mocks/MockGroupsApi";

jest.mock("@flare/core-utils/service-clients", () => {
  return {
    CsodHttpClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGroupsGet,
      };
    }),
  };
});

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...(jest.requireActual("react-router-dom") as any),
  useNavigate: () => mockNavigate,
  useLocation: jest.fn(),
}));

const mockShowSuccessToast = jest.fn();

jest.mock("@flare/primitives/toasts", () => ({
  useShowSuccessToast: () => mockShowSuccessToast,
}));

describe("ManageGroups", () => {
  beforeEach(() => {
    mockCsodGlobal();
    (useLocation as jest.Mock).mockReturnValue({
      state: { showSuccessToast: false },
    });
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("displays the expected localized texts", async () => {
    const { getByText, findAllByText } = render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider value={mockSettings}>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );
    expect(await findAllByText(Keys.ManageGroups)).toHaveLength(2);
    expect(getByText(Keys.CreateGroup)).toBeInTheDocument();
  });

  it("omits the create button when no permission", async () => {
    const { queryByText, findAllByText } = render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider
          value={{ ...mockSettings, hasGroupCreatePermission: false }}
        >
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );
    expect(await findAllByText(Keys.ManageGroups)).toHaveLength(2);
    expect(queryByText(Keys.CreateGroup)).not.toBeInTheDocument();
  });

  it("displays the breadcrumbs correctly", async () => {
    delete (window as any).location;
    window.location = { href: "" } as any;
    const { container, findAllByText } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(await findAllByText(Keys.ManageGroups)).toHaveLength(2);
    const breadcrumbs = container.querySelector("nav[aria-label='breadcrumb']");
    expect(breadcrumbs).toBeVisible();
    const breadcrumbItems = breadcrumbs
      ? breadcrumbs.querySelectorAll("a")
      : [];
    expect(breadcrumbItems.length).toBe(4);

    const firstBreadcrumb = breadcrumbItems[0];
    expect(firstBreadcrumb).toHaveAttribute("aria-label", Keys.Home);
    expect(firstBreadcrumb).toHaveAttribute("href", "/ui/home");
    act(() => fireEvent.click(breadcrumbItems[0]));
    expect(window.location.href).toBe("/ui/home");

    const secondBreadcrumb = breadcrumbItems[1];
    expect(secondBreadcrumb).toHaveTextContent(Keys.ConfigurationTools);
    expect(secondBreadcrumb).toHaveAttribute(
      "href",
      "/phnx/driver.aspx?routename=Admin/Tools"
    );

    const thirdBreadcrumb = breadcrumbItems[2];
    expect(thirdBreadcrumb).toHaveTextContent(Keys.CoreFunctions);
    expect(thirdBreadcrumb).toHaveAttribute(
      "href",
      "/phnx/driver.aspx?routename=Admin/Links&linkId=2"
    );

    const fourthBreadcrumb = breadcrumbItems[3];
    expect(fourthBreadcrumb).toHaveTextContent(Keys.ManageGroups);
    expect(fourthBreadcrumb).toHaveAttribute("href", "/groups/manage");
  });

  it("displays the active and inactive/draft toggle button group correctly", async () => {
    const { findByRole, getByLabelText, getByTestId, findByText } = render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider value={mockSettings}>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );

    const radioGroupButtons = (
      await findByRole("radiogroup")
    ).getElementsByTagName("div");
    const publishedToggleButton = radioGroupButtons[0];
    const draftToggleButton = radioGroupButtons[1];
    const includeInactiveCheckbox = getByLabelText(Keys.IncludeInactive);
    const paginationInfo = getByTestId("pagination-info-text");

    expect(publishedToggleButton).toBeInTheDocument();
    expect(publishedToggleButton).toHaveTextContent(Keys.Published);
    expect(publishedToggleButton).toBeChecked();
    expect(includeInactiveCheckbox).toBeInTheDocument();
    expect(includeInactiveCheckbox).not.toBeChecked();
    expect(draftToggleButton).toBeInTheDocument();
    expect(draftToggleButton).toHaveTextContent(Keys.Draft);
    expect(draftToggleButton).not.toBeChecked();
    await waitFor(() => expect(paginationInfo).toHaveTextContent("243"));
    act(() => fireEvent.click(includeInactiveCheckbox));
    expect(includeInactiveCheckbox).toBeChecked();
    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "groups?IncludeInactive=true&SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
    await waitFor(() => expect(paginationInfo).toHaveTextContent("279"));
    act(() => fireEvent.click(draftToggleButton));
    expect(publishedToggleButton).not.toBeChecked();
    expect(draftToggleButton).toBeChecked();
    expect(includeInactiveCheckbox).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "drafts?SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
    await findByText("2014 Hi Potential Women");
    await waitFor(() => expect(paginationInfo).toHaveTextContent("102"));

    act(() => fireEvent.click(publishedToggleButton));
    expect(publishedToggleButton).toBeChecked();
    expect(draftToggleButton).not.toBeChecked();
    expect(includeInactiveCheckbox).toBeChecked();
    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "groups?IncludeInactive=true&SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
    await findByText("A Parent Group - Entire Division");
    expect(paginationInfo).toHaveTextContent("279");
  }, 10000);

  it("displays parent breadcrumbs and child groups when clicking on parent group right caret icon", async () => {
    const { findByTestId, findByText, findAllByText } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );
    await findByText("A Parent Group - Entire Division");
    const table = (await findByTestId("table-container")).getElementsByTagName(
      "table"
    )[0];
    const rightCaretIcon = table.querySelector(
      "lego-icon[data-icon-name='chevron-right']"
    );
    expect(rightCaretIcon).toBeVisible();
    if (rightCaretIcon) act(() => fireEvent.click(rightCaretIcon));
    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "groups?ParentGroupId=100&SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
    await findByText("2/28/2023 15:20"); // wait for a child group to load
    const parentGroupTexts = await findAllByText(
      "A Parent Group - Entire Division"
    );
    expect(parentGroupTexts.length).toBe(2);

    const parentGroupBreadcrumb = parentGroupTexts[0].closest("a");
    expect(parentGroupBreadcrumb).toHaveAttribute("href", "100");

    const parentGroupRowDiv = parentGroupTexts[1].closest("div");
    const leftCaretIcon =
      parentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(leftCaretIcon).toHaveAttribute("data-icon-name", "chevron-left");
    expect(rightCaretIcon).not.toBeVisible();
    const paginationInfo = await findByTestId("pagination-info-text");
    expect(paginationInfo).toHaveTextContent("28");
  });

  it("navigate to sub parent group", async () => {
    const { findAllByText, findByTestId } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );
    const parentGroupTexts = await findAllByText(
      "A Parent Group - Entire Division"
    );
    expect(parentGroupTexts.length).toBe(1);
    const parentGroupRowDiv = parentGroupTexts[0].closest("div");
    const rightCaretIcon =
      parentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(rightCaretIcon).toHaveAttribute("data-icon-name", "chevron-right");
    if (rightCaretIcon) act(() => fireEvent.click(rightCaretIcon));

    const subParentGroupTexts = await findAllByText("Atlas Hi Potentials");
    expect(subParentGroupTexts.length).toBe(1);
    const subParentGroupRowDiv = subParentGroupTexts[0].closest("div");
    const subParentRightCaretIcon =
      subParentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(subParentRightCaretIcon).toHaveAttribute(
      "data-icon-name",
      "chevron-right"
    );
    if (subParentRightCaretIcon)
      act(() => fireEvent.click(subParentRightCaretIcon));

    const paginationInfo = await findByTestId("pagination-info-text");

    expect(paginationInfo).toHaveTextContent("20");
  });

  it("navigate back to parent group when clicking on Manage Groups breadcrumb", async () => {
    const { findAllByText, findByTestId, findAllByTestId } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );
    const parentGroupTexts = await findAllByText(
      "A Parent Group - Entire Division"
    );

    expect(parentGroupTexts.length).toBe(1);
    const parentGroupRowDiv = parentGroupTexts[0].closest("div");
    const rightCaretIcon =
      parentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(rightCaretIcon).toHaveAttribute("data-icon-name", "chevron-right");
    if (rightCaretIcon) act(() => fireEvent.click(rightCaretIcon));

    await findAllByTestId("rcl$breadcrumb_A Parent Group - Entire Division");
    const topLevelBreadcrumbs = await findAllByTestId(
      `rcl$breadcrumb_${Keys.ManageGroups}`
    );

    expect(topLevelBreadcrumbs[1]).toBeVisible();
    act(() => fireEvent.click(topLevelBreadcrumbs[1]));

    const paginationInfo = await findByTestId("pagination-info-text");
    expect(paginationInfo).toHaveTextContent("243");
  });

  it("when parent group is selected, parent group id is set in session", async () => {
    const { findAllByText, findByTestId } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );

    const parentGroupTexts = await findAllByText(
      "A Parent Group - Entire Division"
    );

    // assert initial value
    expect(sessionStorage.getItem(SessionKeys.GroupsParentId)).toBe(null);
    const parentGroupRowDiv = parentGroupTexts[0].closest("div");
    const rightCaretIcon =
      parentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(rightCaretIcon).toHaveAttribute("data-icon-name", "chevron-right");
    // act
    if (rightCaretIcon) await act(async () => fireEvent.click(rightCaretIcon));
    // assert new value
    expect(sessionStorage.getItem(SessionKeys.GroupsParentId)).toBe("100");
    expect(mockGroupsGet).toHaveBeenCalledWith(
      "groups?ParentGroupId=100&SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
    );

    // perform similar action on subparent
    await findByTestId("table-container");
    const subParentGroupTexts = await findAllByText("Atlas Hi Potentials");
    expect(subParentGroupTexts.length).toBe(1);
    const subParentGroupRowDiv = subParentGroupTexts[0].closest("div");
    const subParentRightCaretIcon =
      subParentGroupRowDiv?.getElementsByTagName("lego-icon")[0];
    expect(subParentRightCaretIcon).toHaveAttribute(
      "data-icon-name",
      "chevron-right"
    );
    if (subParentRightCaretIcon)
      act(() => fireEvent.click(subParentRightCaretIcon));
    await findByTestId("table-container");
    // assert new value
    expect(sessionStorage.getItem(SessionKeys.GroupsParentId)).toBe("195");
  });

  it("when parent group id is set in session, parent group is selected", async () => {
    sessionStorage.setItem(SessionKeys.GroupsParentId, "100");
    act(() =>
      render(
        <ThemeProvider>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </ThemeProvider>
      )
    );

    const tableContainer = await screen.findByTestId("table-container");
    const parentGroupText = (
      await within(tableContainer).findAllByText(
        "A Parent Group - Entire Division"
      )
    )[0];
    const parentGroupRowDiv = parentGroupText.closest("div");
    const leftCaretIcon = await parentGroupRowDiv?.getElementsByTagName(
      "lego-icon"
    )[0];
    // parent group found and selected
    expect(leftCaretIcon).toHaveAttribute("data-icon-name", "chevron-left");

    //
    // unselect parent by clicking bread crumb
    const topLevelBreadcrumbs = await screen.findAllByTestId(
      `rcl$breadcrumb_${Keys.ManageGroups}`
    );
    expect(topLevelBreadcrumbs[1]).toBeVisible();

    await act(async () => fireEvent.click(topLevelBreadcrumbs[1]));

    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "groups?SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
    // assert session storage value is unset
    expect(sessionStorage.getItem(SessionKeys.GroupsParentId)).toBe(null);
  });

  describe("row actions", () => {
    it.skip("shows edit and view actions when permissions allow", async () => {
      const { findByRole, findAllByText, findAllByTestId } = render(
        <ThemeProvider>
          <GroupAdminSettingsContext.Provider value={mockSettings}>
            <MemoryRouter>
              <ManageGroups />
            </MemoryRouter>
          </GroupAdminSettingsContext.Provider>
        </ThemeProvider>
      );

      await waitFor(async () =>
        expect(await findAllByText(Keys.Edit)).toHaveLength(25)
      );

      // Verify basic row actions are visible
      const firstRow = (await findAllByTestId("table-body-row"))[0];
      expect(within(firstRow).getByText(Keys.Edit)).toBeVisible();
      expect(within(firstRow).getByText(Keys.View)).toBeVisible();
      expect(within(firstRow).getAllByRole("button")).toHaveLength(4);

      // Click on more actions button to enumerate options
      const moreButton = within(firstRow).getAllByRole("button")[3];
      await act(() => userEvent.click(moreButton));

      // Validate more actions options
      await waitFor(async () => expect(await findByRole("menu")).toBeVisible());
      expect(moreButton).toHaveAttribute("aria-expanded", "true");
      const moreMenu = await findByRole("menu");
      expect(within(moreMenu).getByText(Keys.ViewMembers)).toBeVisible();
      expect(within(moreMenu).getByText(Keys.Copy)).toBeVisible();
    });

    it.skip("omits edit action when permissions disallow", async () => {
      const { findByRole, findAllByText, findAllByTestId } = render(
        <ThemeProvider>
          <GroupAdminSettingsContext.Provider
            value={{ ...mockSettings, hasGroupEditPermission: false }}
          >
            <MemoryRouter>
              <ManageGroups />
            </MemoryRouter>
          </GroupAdminSettingsContext.Provider>
        </ThemeProvider>
      );

      await waitFor(async () =>
        expect(await findAllByText(Keys.View)).toHaveLength(25)
      );

      // Verify basic row actions are visible
      const secondRow = (await findAllByTestId("table-body-row"))[1];
      expect(within(secondRow).queryByText(Keys.Edit)).not.toBeVisible();
      expect(within(secondRow).getByText(Keys.View)).toBeVisible();
      expect(within(secondRow).getAllByRole("button")).toHaveLength(3);

      // Click on more actions button to enumerate options
      const moreButton = within(secondRow).getAllByRole("button")[2];
      await act(() => userEvent.click(moreButton));

      // Validate more actions options
      await waitFor(async () => expect(await findByRole("menu")).toBeVisible());
      expect(moreButton).toHaveAttribute("aria-expanded", "true");
      const moreMenu = await findByRole("menu");
      expect(within(moreMenu).getByText(Keys.ViewMembers)).toBeVisible();
      expect(within(moreMenu).getByText(Keys.Copy)).toBeVisible();
    });

    it.skip("omits edit and copy actions when permissions disallow", async () => {
      const { findByRole, findAllByText, findAllByTestId } = render(
        <ThemeProvider>
          <GroupAdminSettingsContext.Provider
            value={{
              ...mockSettings,
              hasGroupCreatePermission: false,
              hasGroupEditPermission: false,
            }}
          >
            <MemoryRouter>
              <ManageGroups />
            </MemoryRouter>
          </GroupAdminSettingsContext.Provider>
        </ThemeProvider>
      );

      await waitFor(async () =>
        expect(await findAllByText(Keys.Active)).toHaveLength(25)
      );

      // Verify basic row actions are visible
      const secondRow = (await findAllByTestId("table-body-row"))[1];
      expect(within(secondRow).queryByText(Keys.Edit)).not.toBeVisible();
      expect(within(secondRow).getAllByRole("button")).toHaveLength(3);

      // Click on more actions button to enumerate options
      const moreButton = within(secondRow).getAllByRole("button")[2];
      await act(() => userEvent.click(moreButton));

      // Validate more actions options
      await waitFor(async () => expect(await findByRole("menu")).toBeVisible());
      expect(moreButton).toHaveAttribute("aria-expanded", "true");
      const moreMenu = await findByRole("menu");
      expect(within(moreMenu).getByText(Keys.ViewMembers)).toBeVisible();
      expect(within(moreMenu).queryByText(Keys.Copy)).not.toBeInTheDocument();
    });

    it.skip("launches View Members when View Members is clicked", async () => {
      const {
        findByRole,
        findAllByText,
        findAllByTestId,
        findByTestId,
        getByRole,
        getByTestId,
      } = render(
        <ThemeProvider>
          <GroupAdminSettingsContext.Provider value={mockSettings}>
            <MemoryRouter>
              <ManageGroups />
            </MemoryRouter>
          </GroupAdminSettingsContext.Provider>
        </ThemeProvider>
      );

      await waitFor(async () =>
        expect(await findAllByText(Keys.Active)).toHaveLength(25)
      );

      // Open action menu
      const firstRow = (await findAllByTestId("table-body-row"))[0];
      const moreButton = within(firstRow).getAllByRole("button")[3];
      await act(() => userEvent.click(moreButton));
      await waitFor(async () => expect(await findByRole("menu")).toBeVisible());

      // Select View Members
      const actionMenu = getByRole("menu");
      await act(() =>
        userEvent.click(within(actionMenu).getByText(Keys.ViewMembers))
      );

      // Verify view members iframe is visible
      await waitFor(async () =>
        expect(await findByTestId("rcl$modal_standard")).toBeVisible()
      );
      const modalContent = getByTestId("rcl$modal_standard_body_content");
      expect(modalContent.firstChild).toBeVisible();
    });
  });

  it.skip("Does not display View Members action for drafts tab", async () => {
    const { findByRole, findAllByText, findAllByTestId, getByRole } = render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider value={mockSettings}>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );

    await waitFor(async () =>
      expect(await findAllByText(Keys.Active)).toHaveLength(25)
    );

    const tabs = getByRole("radiogroup");
    await act(() => userEvent.click(within(tabs).getByText(Keys.Draft)));
    await waitFor(async () =>
      expect(await findAllByText(Keys.Draft)).toHaveLength(26)
    );

    // Verify basic row actions are visible
    const firstRow = (await findAllByTestId("table-body-row"))[0];
    expect(within(firstRow).getAllByRole("button")).toHaveLength(3);

    // Click on more actions button to enumerate options
    const moreButton = within(firstRow).getAllByRole("button")[2];
    await act(() => userEvent.click(moreButton));

    // Validate more actions options
    await waitFor(async () => expect(await findByRole("menu")).toBeVisible());
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    const moreMenu = await findByRole("menu");
    expect(
      within(moreMenu).queryByText(Keys.ViewMembers)
    ).not.toBeInTheDocument();
  });

  it("Calls the API with correct params when search input is used", async () => {
    const { findByLabelText } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ManageGroups />
        </MemoryRouter>
      </ThemeProvider>
    );

    const searchInput = await findByLabelText(Keys.SearchTitleOrId);
    expect(searchInput).toBeInTheDocument();
    act(() => fireEvent.change(searchInput, { target: { value: "test" } }));
    await waitFor(() =>
      expect(mockGroupsGet).toHaveBeenCalledWith(
        "groups?Keyword=test&SortBy=title&SortOrder=Ascending&PageNumber=1&PageSize=25"
      )
    );
  });

  it("Click on the Published/Draft toggle button and verify the manage group state", async () => {
    const { findByRole } = render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider value={mockSettings}>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );
    const radioGroupButtons = (
      await findByRole("radiogroup")
    ).getElementsByTagName("div");
    const publishedToggleButton = radioGroupButtons[0];
    const draftToggleButton = radioGroupButtons[1];
    expect(publishedToggleButton).toBeInTheDocument();
    expect(publishedToggleButton).toHaveTextContent(Keys.Published);
    expect(publishedToggleButton).toBeChecked();
    expect(draftToggleButton).toBeInTheDocument();
    expect(draftToggleButton).toHaveTextContent(Keys.Draft);
    expect(draftToggleButton).not.toBeChecked();
    act(() => fireEvent.click(draftToggleButton));
    expect(publishedToggleButton).not.toBeChecked();
    expect(draftToggleButton).toBeChecked();
    await waitFor(() =>
      expect(sessionStorage.getItem(SessionKeys.ManageGroupTab)).toBe(
        ManageGroupTabs.Draft
      )
    );
    expect(publishedToggleButton).not.toBeChecked();
    act(() => fireEvent.click(publishedToggleButton));
    expect(draftToggleButton).not.toBeChecked();
    expect(publishedToggleButton).toBeChecked();
    await waitFor(() =>
      expect(sessionStorage.getItem(SessionKeys.ManageGroupTab)).toBe(
        ManageGroupTabs.Published
      )
    );
  });

  it("Redirects to the error page when an error occurs retrieving groups", async () => {
    mockGroupsGet.mockRejectedValue(new Error("Test error"));
    act(() =>
      render(
        <ThemeProvider>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </ThemeProvider>
      )
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/error"));
  });

  it("Shows a success toast when a group is created/updated", async () => {
    (useLocation as jest.Mock).mockReturnValue({
      state: {
        showSuccessToast: true,
      },
    });
    render(
      <ThemeProvider>
        <GroupAdminSettingsContext.Provider value={mockSettings}>
          <MemoryRouter>
            <ManageGroups />
          </MemoryRouter>
        </GroupAdminSettingsContext.Provider>
      </ThemeProvider>
    );
    expect(await screen.findAllByText(Keys.ManageGroups)).toHaveLength(2);
    expect(mockShowSuccessToast).toHaveBeenCalledWith(Keys.SaveSuccessMessage, {
      autoDismiss: true,
    });
  });
});
