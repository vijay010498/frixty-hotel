import React, { useState } from "react";
// nodejs library that concatenates classes
import classNames from "classnames";
import axios from "axios";

// reactstrap components
import {
  Button,
  Collapse,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  Input,
  InputGroup,
  NavbarBrand,
  Navbar,
  NavLink,
  Nav,
  Container,
  Modal,
  UncontrolledTooltip,
  Spinner,
} from "reactstrap";
import { Redirect } from "react-router-dom";

const AdminNavbar = (props) => {
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const [loadingSpinnerActive, setLoadingSpinnerActive] = useState(false);
  const [collapseOpen, setCollapseOpen] = React.useState(false);
  const [color, setColor] = React.useState("navbar-transparent");
  React.useEffect(() => {
    window.addEventListener("resize", updateColor);
    return function cleanup() {
      window.removeEventListener("resize", updateColor);
    };
  });
  //logout user
  async function handleLogout() {
    try {
      const response = await axios.post("/api/secure/sAdmin/signOut");
      if (response.status === 200) {
        setLogoutSuccess(true);
        setLoadingSpinnerActive(false);
      }
    } catch (err) {
      //Logout Failed
      console.log("Logout Failed");
      setLoadingSpinnerActive(false);
    }
  }

  function checkForSpinner() {
    if (loadingSpinnerActive) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <Button
            className="mb-2"
            color="info"
            disabled
            size="md"
            type="button"
          >
            <Spinner type="grow" size="lg" role="status" />
            Loading..
          </Button>
        </div>
      );
    }
  }

  // function that adds color white/transparent to the navbar on resize (this is for the collapse)
  const updateColor = () => {
    if (window.innerWidth < 993 && collapseOpen) {
      setColor("bg-white");
    } else {
      setColor("navbar-transparent");
    }
  };
  // this function opens and closes the collapse on small devices
  const toggleCollapse = () => {
    if (collapseOpen) {
      setColor("navbar-transparent");
    } else {
      setColor("bg-white");
    }
    setCollapseOpen(!collapseOpen);
  };
  return (
    <>
      {logoutSuccess ? <Redirect to="/auth" /> : ""}
      {checkForSpinner()}
      <Navbar
        className={classNames("navbar-absolute", {
          [color]: props.location.pathname.indexOf("full-screen-map") === -1,
        })}
        expand="lg"
      >
        <Container fluid>
          <div className="navbar-wrapper">
            <div className="navbar-minimize d-inline">
              <Button
                className="minimize-sidebar btn-just-icon"
                color="link"
                id="tooltip209599"
                onClick={props.handleMiniClick}
              >
                <i className="tim-icons icon-align-center visible-on-sidebar-regular" />
                <i className="tim-icons icon-bullet-list-67 visible-on-sidebar-mini" />
              </Button>
              <UncontrolledTooltip
                delay={0}
                target="tooltip209599"
                placement="right"
              >
                Sidebar toggle
              </UncontrolledTooltip>
            </div>
            <div
              className={classNames("navbar-toggle d-inline", {
                toggled: props.sidebarOpened,
              })}
            >
              <button
                className="navbar-toggler"
                type="button"
                onClick={props.toggleSidebar}
              >
                <span className="navbar-toggler-bar bar1" />
                <span className="navbar-toggler-bar bar2" />
                <span className="navbar-toggler-bar bar3" />
              </button>
            </div>
            <NavbarBrand href="#pablo" onClick={(e) => e.preventDefault()}>
              {props.brandText}
            </NavbarBrand>
          </div>
          <button
            className="navbar-toggler"
            type="button"
            data-toggle="collapse"
            data-target="#navigation"
            aria-expanded="false"
            aria-label="Toggle navigation"
            onClick={toggleCollapse}
          >
            <span className="navbar-toggler-bar navbar-kebab" />
            <span className="navbar-toggler-bar navbar-kebab" />
            <span className="navbar-toggler-bar navbar-kebab" />
          </button>
          <Collapse navbar isOpen={collapseOpen}>
            <Nav className="ml-auto" navbar>
              <UncontrolledDropdown nav>
                <DropdownToggle
                  caret
                  color="default"
                  data-toggle="dropdown"
                  nav
                  onClick={(e) => e.preventDefault()}
                >
                  <div className="photo">
                    <img
                      alt="..."
                      src={require("assets/img/default-avatar.png").default}
                    />
                  </div>
                  <b className="caret d-none d-lg-block d-xl-block" />
                  <p className="d-lg-none">Log out</p>
                </DropdownToggle>
                <DropdownMenu className="dropdown-navbar" right tag="ul">
                  <NavLink tag="li">
                    <DropdownItem className="nav-item">Profile</DropdownItem>
                  </NavLink>
                  <NavLink tag="li">
                    <DropdownItem className="nav-item">Settings</DropdownItem>
                  </NavLink>
                  <DropdownItem divider tag="li" />
                  <NavLink tag="li">
                    <DropdownItem
                      className="nav-item"
                      onClick={(event) => {
                        event.preventDefault();
                        setLoadingSpinnerActive(true);
                        handleLogout();
                      }}
                    >
                      Log out
                    </DropdownItem>
                  </NavLink>
                </DropdownMenu>
              </UncontrolledDropdown>
              <li className="separator d-lg-none" />
            </Nav>
          </Collapse>
        </Container>
      </Navbar>
    </>
  );
};

export default AdminNavbar;
