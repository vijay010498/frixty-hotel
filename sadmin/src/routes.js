import Login from "./views/pages/Login";
import Dashboard from "./views/Dashboard";
import currencyExchangeRates from "./views/currencyExchangeRates";
const routes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "tim-icons icon-chart-pie-36",
    component: Dashboard,
    layout: "/admin",
  },
  {
    path: "/currency",
    name: "Live Currency Rates     " + new Date().toLocaleDateString(),
    icon: "icon-money-coins",
    component: currencyExchangeRates,
    layout: "/admin",
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    layout: "/auth",
  },
];

export default routes;
