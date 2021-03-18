import "assets/css/nucleo-icons.css";
import "react-notification-alert/dist/animate.css";
import "assets/scss/black-dashboard-pro-react.scss?v=1.2.0";
import "assets/demo/demo.css";

import React from "react";
import ReactDom from "react-dom";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";

import AuthLayout from "layouts/Auth/Auth";
import AdminLayout from "layouts/Admin/Admin";

ReactDom.render(
  <BrowserRouter>
    <Switch>
      <Route path="/admin" render={(props) => <AdminLayout {...props} />} />
      <Route path="/auth" render={(props) => <AuthLayout {...props} />} />
      <Redirect from="*" to="/admin" />
    </Switch>
  </BrowserRouter>,
  document.getElementById("root")
);
