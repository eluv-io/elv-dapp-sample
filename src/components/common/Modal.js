import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {rootStore} from "Stores";
import {observer} from "mobx-react";
import CloseIcon from "../../static/icons/x.svg";
import ImageIcon from "Components/common/ImageIcon";

const Modal = observer(({children, Toggle, id="", className=""}) => {
  const [scrolled, setScrolled] = useState(false);

  const Close = (event) => {
    if(event && (event.key || "").toLowerCase() !== "escape") { return; }

    document.removeEventListener("keydown", Close);
    document.body.style.overflowY = "scroll";

    Toggle(false);
  };

  useEffect(() => {
    document.addEventListener("keydown", Close);
    document.body.style.overflowY = "hidden";

    rootStore.AddActiveModal();

    return () => {
      document.removeEventListener("keydown", Close);
      document.body.style.overflowY = "scroll";

      rootStore.RemoveActiveModal();
    };
  }, []);

  return (
    <div id={id} className={`modal ${className || ""}`} onClick={() => Close()}>
      {
        Toggle ?
          <button className="modal__close-button">
            <ImageIcon
              key={"back-icon-Close Modal"}
              className={"modal__close-icon"}
              title={"Close Modal"}
              icon={CloseIcon}
              onClick={() => Close()}
            />
          </button> :
          null
      }
      <div
        className="modal__content"
        onClick={event => event.stopPropagation()}
        ref={element => {
          // Ensure content is scrolled to top on first render
          if(!element || scrolled) { return; }

          element.scrollTo(0, 0);

          setScrolled(true);
        }}
      >
        { children }
      </div>
    </div>
  );
});

const ModalPortal = (args) => {
  return (
    createPortal(
      <Modal {...args} />,
      document.getElementById("app")
    )
  );
};

export default ModalPortal;
