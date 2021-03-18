import React from "react";
import classnames from "classnames";
import { NavLink } from "react-router-dom";

//reactstrap
import {
  Collapse,
  NavbarBrand,
  Navbar,
  NavItem,
  Nav,
  Container,
} from "reactstrap";

const AuthNavbar = (props) => {
  const [collapseOpen, setCollapseOpen] = React.useState(false);
  const [color, setColor] = React.useState("navbar-transparent");
  // this function opens and closes the collapse on small devices
  // it also adds navbar-transparent class to the navbar when closed
  // ad bg-white when opened
  const toggleCollapse = () => {
    if (collapseOpen) {
      setColor("navbar-transparent");
    } else {
      setColor("bg-white");
    }
    setCollapseOpen(!collapseOpen);
  };

  return (
    <Navbar
      className={classnames("navbar-absolute fixed-top", color)}
      expand="lg"
    >
      <Container fluid>
        <div className="navbar-wrapper">
          <NavbarBrand href="#" onClick={(event) => event.preventDefault()}>
            {props.brandText}
          </NavbarBrand>
        </div>

        <button
          aria-controls="navigation-index"
          aria-expanded={false}
          aria-label="Toggle navigation"
          className="navbar-toggler"
          data-toggle="collapse"
          type="button"
          onClick={toggleCollapse}
        >
          <span className="navbar-toggler-bar navbar-kebab" />
          <span className="navbar-toggler-bar navbar-kebab" />
          <span className="navbar-toggler-bar navbar-kebab" />
        </button>
        <Collapse isOpen={collapseOpen} navbar>
          <Nav navbar className="ml-auto">
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="#" className="nav-link text-primary">
                <i className="tim-icons icon-minimal-left" />
                Option 1
              </NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Container>
    </Navbar>
  );
};

export default AuthNavbar;
