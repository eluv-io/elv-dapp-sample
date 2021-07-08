import React from "react";
import {observer} from "mobx-react";
import {NavLink} from "react-router-dom";

const Navigation = observer(() => {
  return (
    <nav className="navigation">
      <NavLink className="navigation__link" to="/discover">Discover</NavLink>
      <NavLink className="navigation__link" to="/wallet">Wallet</NavLink>
      <NavLink className="navigation__link" to="/profile">Profile</NavLink>
    </nav>
  );
});

export default Navigation;
