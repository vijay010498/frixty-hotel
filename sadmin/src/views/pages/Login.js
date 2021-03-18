import React, { useState } from "react";
import classnames from "classnames";
import axios from "axios";
//reactstrap
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Container,
  Col,
  Alert,
  Spinner,
} from "reactstrap";
import { Redirect, Route } from "react-router-dom";

const Login = () => {
  const [loadingSpinnerActive, setLoadingSpinnerActive] = useState(true);
  const [verificationCompleted, setVerificationCompleted] = useState(false);
  const [showLoginFailedAlert, setShowLoginFailedAlert] = useState(false);
  const [showEmailFailedAlert, setShowEmailFailedAlert] = useState(false);
  const [showPasswordFailedAlert, setShowPasswordFailedAlert] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = React.useState({});

  //If already logged in redirect to admin dashboard run only at initial render
  React.useEffect(() => {
    async function isAlreadyLoggedInAndVerified() {
      return await axios.get(
        "https://shielded-retreat-47698.herokuapp.com/api/secure/sAdmin/verifyAuth"
      );
    }
    isAlreadyLoggedInAndVerified()
      .then((response) => {
        if (response.status === 202) {
          console.log("Already Logged in and verified");
          setVerificationCompleted(true);
          setLoadingSpinnerActive(false);
        }
      })
      .catch((err) => {
        console.log("Not Logged In Or Login Failed");
        setVerificationCompleted(false);
        setLoadingSpinnerActive(false);
      });
  }, []);

  React.useEffect(() => {
    if (showLoginFailedAlert) {
      setEmail("");
      setPassword("");
    }
  }, [showLoginFailedAlert]);

  React.useEffect(() => {
    document.body.classList.toggle("login-page");
    return function cleanup() {
      document.body.classList.toggle("login-page");
    };
  });

  async function handleLogin() {
    if (email === "") {
      //email empty
      setShowEmailFailedAlert(true);
    } else if (password === "") {
      setShowPasswordFailedAlert(true);
    } else {
      //Process login
      setLoadingSpinnerActive(true);
      try {
        const response = await axios.post(
          "https://shielded-retreat-47698.herokuapp.com/api/secure/sAdmin/signIn",
          {
            email: email.trim(),
            password: password.trim(),
          }
        );
        if (response.status === 201) {
          setLoadingSpinnerActive(false);
          setVerificationCompleted(true);
        }
      } catch (err) {
        //Login Failed
        setLoadingSpinnerActive(false);
        console.log("Login Failed");
        setShowLoginFailedAlert(true);
      }
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

  return (
    <>
      <div className="content">
        {verificationCompleted ? (
          <Redirect to="/admin" />
        ) : (
          console.log("Verification pending")
        )}
        <Container>
          <Col className="ml-auto mr-auto" lg="4" md="6">
            <Form className="form">
              <Card className="card-login card-white">
                <CardHeader>
                  <img
                    alt="..."
                    src={require("assets/img/card-primary.png").default}
                  />
                  <CardTitle tag="h1">Log In</CardTitle>
                </CardHeader>
                {checkForSpinner()}
                <CardBody>
                  <InputGroup
                    className={classnames({
                      "input-group-focus": state.emailFocus,
                    })}
                  >
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>
                        <i className="tim-icons icon-email-85" />
                      </InputGroupText>
                    </InputGroupAddon>

                    <Input
                      placeholder="Email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setShowEmailFailedAlert(false);
                        setShowLoginFailedAlert(false);
                      }}
                      onFocus={(e) => setState({ ...state, emailFocus: true })}
                      onBlur={(e) => setState({ ...state, emailFocus: false })}
                    />
                  </InputGroup>
                  <Alert color="info" isOpen={showEmailFailedAlert}>
                    <span>
                      <b> Error - </b>Email is Not valid or Empty
                    </span>
                  </Alert>
                  <InputGroup
                    className={classnames({
                      "input-group-focus": state.passFocus,
                    })}
                  >
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>
                        <i className="tim-icons icon-lock-circle" />
                      </InputGroupText>
                    </InputGroupAddon>
                    <Input
                      placeholder="Password"
                      type="password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setShowPasswordFailedAlert(false);
                        setShowLoginFailedAlert(false);
                      }}
                      onFocus={(e) => setState({ ...state, passFocus: true })}
                      onBlur={(e) => setState({ ...state, passFocus: false })}
                    />
                  </InputGroup>
                  <Alert color="info" isOpen={showPasswordFailedAlert}>
                    <span>
                      <b> Error - </b>Password Cannot be Empty
                    </span>
                  </Alert>
                </CardBody>
                <CardFooter>
                  <Button
                    block
                    className="mb-3"
                    color="primary"
                    href="#pablo"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLogin();
                    }}
                    size="lg"
                  >
                    GO
                  </Button>

                  <Alert color="warning" isOpen={showLoginFailedAlert}>
                    <span>
                      <b> Error - </b>Login Failed Try Again
                    </span>
                  </Alert>
                </CardFooter>
              </Card>
            </Form>
          </Col>
        </Container>
      </div>
    </>
  );
};

export default Login;
