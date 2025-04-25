sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], (Controller, MessageToast) => {
  "use strict";

  return Controller.extend("retosapui5.retosapui5.controller.MainView", {
    onInit() {
      // Crear modelo y cargar el JSON
      const oUserModel = new sap.ui.model.json.JSONModel();
      oUserModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
      oUserModel.loadData("./model/userModel.json"); // ruta correcta en /webapp

      // MessageManager
      this._MessageManager = sap.ui.getCore().getMessageManager();
      this._MessageManager.removeAllMessages();

      this.getView().setModel(oUserModel, "user");

      // Registrar el contenedor principal del formulario
      this._MessageManager.registerObject(this.byId("formContainerInput"), true);
      this.getView().setModel(this._MessageManager.getMessageModel(), "message");

      // Crear MessagePopover 
      this.createMessagePopover();

      // Modelo de lista de usuarios
      var oUsuariosModel = new sap.ui.model.json.JSONModel();
      oUsuariosModel.loadData("./model/usuariosModel.json", null, false);
      this.getView().setModel(oUsuariosModel, "usuarios");

      // modelo para los dominios de desplegables
      const oDominiosModel = new sap.ui.model.json.JSONModel();
      oDominiosModel.loadData("./model/selectLists.json");
      this.getView().setModel(oDominiosModel, "dominios");

    },

    createMessagePopover: function () {
      const oView = this.getView();

      this._oMessagePopover = new sap.m.MessagePopover({

        activeTitlePress: function (oEvent) {
          const oMessage = oEvent.getParameter("item").getBindingContext("message").getObject();
          const sTarget = oMessage.target;

          // Buscar el control cuyo binding concuerde con el target
          const oControl = this.getView().getControlsByFieldGroupId("formFields").find(ctrl => {
            const oBinding = ctrl.getBinding("value") || ctrl.getBinding("selectedKey");
            if (!oBinding) return false;

            const sContextPath = oBinding.getContext()?.getPath?.() || "";
            const sBindingPath = oBinding.getPath?.() || "";
            const sControlPath = sContextPath + (sBindingPath.startsWith("/") ? sBindingPath : "/" + sBindingPath);

            const match = sControlPath === sTarget;
            return match;
          });

          if (oControl) {
            const oPage = this.byId("page");
            if (oPage && oPage.scrollToElement) {
              oPage.scrollToElement(oControl.getDomRef(), 200, [0, -100]);
            }

            setTimeout(() => {
              oControl.focus();
            }, 300);
          } else {
            console.warn("No se encontró el control asociado al mensaje");
          }
        }.bind(this),


        items: {
          path: "message>/",
          template: new sap.m.MessageItem({
            type: "{message>type}",
            title: "{message>message}",
            subtitle: "{message>additionalText}",
            description: "{message>description}",
            activeTitle: true
          })
        }
      });
      oView.addDependent(this._oMessagePopover);

      const oBinding = this._oMessagePopover.getBinding("items");
      if (oBinding && !oBinding._listenerAttached) {
        oBinding.attachChange(() => {
          const oButton = this.byId("messagePopoverButton");
          if (oButton) {
            oButton.setType(this.mpTypeFormatter());
            oButton.setIcon(this.mpIconFormatter());
            oButton.setText(this.mpSeverityMessages());
          }
        });
        oBinding._listenerAttached = true;
      }
    },

    onMessagePopoverPress: function (oEvent) {
      const oButton = oEvent.getSource();
      this._oMessagePopover.openBy(oButton);
    },

    isPositionable: function (sControlId) {
      return !!sControlId;
    },

    mpIconFormatter: function () {
      const aMessages = this._MessageManager.getMessageModel().getData();
      for (let oMsg of aMessages) {
        switch (oMsg.type) {
          case "Error": return "sap-icon://message-error";
          case "Warning": return "sap-icon://message-warning";
          case "Success": return "sap-icon://message-success";
        }
      }
      return "sap-icon://message-information";
    },

    mpTypeFormatter: function () {
      const aMessages = this._MessageManager.getMessageModel().getData();
      for (let oMsg of aMessages) {
        switch (oMsg.type) {
          case "Error": return "Negative";
          case "Warning": return "Critical";
          case "Success": return "Success";
        }
      }
      return "Neutral";
    },

    mpSeverityMessages: function () {
      const aMessages = this._MessageManager.getMessageModel().getData();
      const iErrors = aMessages.filter(m => m.type === "Error").length;
      const iWarnings = aMessages.filter(m => m.type === "Warning").length;
      //return `Errores: ${iErrors} / Avisos: ${iWarnings}`;
      const oBundle = this.getView().getModel("i18n")?.getResourceBundle();
      return oBundle
        ? oBundle.getText("messagePopoverSummary", [iErrors, iWarnings])
        : `Errores: ${iErrors} / Avisos: ${iWarnings}`;
    },

    onCountryChangedAndValidate: function (oEvent) {
      this.onFieldChange(oEvent);
      this.onCountryChange(oEvent);
    },

    onCountryChange: function (oEvent) {
      const sSelectedCountry = oEvent.getSource().getSelectedKey();
      const oDominiosModel = this.getView().getModel("dominios");
      const oDominiosData = oDominiosModel.getData();

      const aProvincias = oDominiosData.provinces[sSelectedCountry] || [];
      const aRegiones = oDominiosData.regions[sSelectedCountry] || [];

      oDominiosModel.setProperty("/provinciasFiltradas", aProvincias);
      oDominiosModel.setProperty("/regionesFiltradas", aRegiones);

      // al cambiar el pais limpiamos provincia y región
      const oUserModel = this.getView().getModel("user");
      oUserModel.setProperty("/address/province", "");
      oUserModel.setProperty("/address/region", "");

    },

    handleRequiredField: function (oInput) {
      let sValue = "";

      if (oInput.getValue) {
        sValue = oInput.getValue();
      } else if (oInput.getSelectedKey) {
        sValue = oInput.getSelectedKey();
      }

      const oBinding = oInput.getBinding("value") || oInput.getBinding("selectedKey");
      const sContextPath = oBinding?.getContext()?.getPath?.() || "";
      const sBindingPath = oBinding?.getPath?.() || "";
      const sTarget = sBindingPath.startsWith("/")
        ? sContextPath + sBindingPath
        : sContextPath + "/" + sBindingPath;


      //  Eliminar mensajes previos asociados a este campo
      const aOldMessages = this._MessageManager.getMessageModel().getData().filter(msg => msg.target === sTarget);
      this._MessageManager.removeMessages(aOldMessages);

      const bIsEmpty = !sValue || !sValue.trim();
      if (bIsEmpty) {
        oInput.setValueState("Error");

        this._MessageManager.addMessages(new sap.ui.core.message.Message({
          message: this.getText("requiredFieldMessage"),
          type: sap.ui.core.MessageType.Error,
          additionalText: oInput.getLabels?.()[0]?.getText() || "",
          target: sTarget,
          processor: oBinding?.getModel?.()
        }));
      } else {
        oInput.setValueState("None");
      }

    },

    checkInputConstraints: function (grupo, oInput) {
      const oBinding = oInput.getBinding("value");
      if (!oBinding) {
        console.warn("Campo sin binding:", oInput.getId());
        return;
      }

      const sContextPath = oBinding?.getContext()?.getPath?.() || "";
      const sBindingPath = oBinding?.getPath?.() || "";
      const sTarget = sBindingPath.startsWith("/")
        ? sContextPath + sBindingPath
        : sContextPath + "/" + sBindingPath;

      // Si ya hay un mensaje de tipo Error para este target, no seguimos
      const aMessages = this._MessageManager.getMessageModel().getData();
      const bHasRequiredError = aMessages.some(msg => msg.target === sTarget && msg.type === "Error" && msg.message === "Campo obligatorio");
      if (bHasRequiredError) {
        return; // Ya tiene error por requerido, no validamos más
      }

      const addMessage = (type, message, description) => {
        oInput.setValueState(type === "Error" ? "Error" : "Warning");
        this._MessageManager.addMessages(new sap.ui.core.message.Message({
          message: message,
          type: sap.ui.core.MessageType[type],
          additionalText: oInput.getLabels?.()[0]?.getText() || "",
          description: description,
          target: sTarget,
          processor: oBinding.getModel()
        }));
      };

      try {
        const vValue = oInput.getValue();

        switch (grupo) {

          case "birthDate":
            const oDate = oInput.getDateValue();
            if (!oDate) return; // no borrar el mensaje de requerido si está vacío

            const oParsedDate = new Date(oDate);
            oParsedDate.setHours(0, 0, 0, 0);

            const oToday = new Date();
            oToday.setHours(0, 0, 0, 0);

            // limpiar mensajes solo si hay valor
            const aOldBirth = this._MessageManager.getMessageModel().getData().filter(msg => msg.target === sTarget);
            this._MessageManager.removeMessages(aOldBirth);

            if (oParsedDate > oToday) {
              addMessage("Error", this.getText("invalidDateTitle"), this.getText("invalidDateDescription"));
              return;
            }

            const diffAnios = (oToday - oParsedDate) / (1000 * 60 * 60 * 24 * 365.25);
            if (diffAnios < 3) {
              addMessage("Warning", this.getText("recentDateTitle"), this.getText("recentDateDescription"));
              return;
            }

            break;

          case "postal":
            if (!vValue || !vValue.trim()) return;

            const aOldPostal = this._MessageManager.getMessageModel().getData().filter(msg => msg.target === sTarget);
            this._MessageManager.removeMessages(aOldPostal);

            if (vValue.length < 3 || vValue.length > 10) {
              addMessage("Warning", this.getText("postalCodeWarningTitle"), this.getText("postalCodeWarningDescription"));
              return;
            }

            break;

          case "email":
            if (!vValue || !vValue.trim()) return;

            const aOldEmail = aMessages.filter(msg => msg.target === sTarget);
            this._MessageManager.removeMessages(aOldEmail);

            const regexEmail = /^\S+@\S+\.\S+$/;
            if (!regexEmail.test(vValue)) {
              addMessage("Error", this.getText("emailErrorTitle"), this.getText("emailErrorDescription"));
              return;
            }

            break;

          case "phone":
            if (!vValue || !vValue.trim()) return;

            const aOldPhone = aMessages.filter(msg => msg.target === sTarget);
            this._MessageManager.removeMessages(aOldPhone);

            const regexPhone = /^\+?[0-9]{9,15}$/;
            if (!regexPhone.test(vValue)) {
              addMessage("Error", this.getText("phoneErrorTitle"), this.getText("phoneErrorDescription"));
              return;
            }

            break;


          default:
            return;
        }

        oInput.setValueState("None");

      } catch (e) {
        oInput.setValueState("Error");
        this._MessageManager.addMessages(new sap.ui.core.message.Message({
          message: this.getText("invalidValueMessage"),
          type: sap.ui.core.MessageType.Error,
          additionalText: oInput.getLabels?.()[0]?.getText() || "",
          description: e.message || this.getText("defaultFieldDescription"),
          target: sTarget,
          processor: oBinding.getModel()
        }));
      }
    },

    onFieldChange: function (oEvent) {
      const oInput = oEvent.getSource();

      // Validar campo requerido si aplica
      if (oInput.getRequired?.()) {
        this.handleRequiredField(oInput);
      }

      // Mapeo de ID parcial a grupo de validación
      const aValidaciones = [
        { id: "inputEmail", grupo: "email" },
        { id: "inputPostalCode", grupo: "postal" },
        { id: "inputPhoneNumber", grupo: "phone" },
        { id: "inputBirthDate", grupo: "birthDate" }
      ];

      const sInputId = oInput.getId();
      const oVal = aValidaciones.find(v => sInputId.includes(v.id));
      if (oVal) {
        this.checkInputConstraints(oVal.grupo, oInput);
      }

      // Forzar actualización del binding aunque haya warning
      const oBinding = oInput.getBinding("value");
      if (oBinding) {
        oBinding.checkUpdate(true); // true = force
      }
    },

    onGuardarUsuario: function () {
      const oView = this.getView();
      const oMessageManager = this._MessageManager;

      // Limpiar mensajes anteriores
      oMessageManager.removeAllMessages();

      // Validar campos obligatorios
      const aControls = oView.getControlsByFieldGroupId("formFields");
      aControls.forEach(oControl => {
        if (oControl.getRequired && oControl.getRequired()) {
          this.handleRequiredField(oControl);
        }
      });

      // Validar constraints personalizados
      this.checkInputConstraints("email", this.byId("inputEmail"));
      this.checkInputConstraints("postal", this.byId("inputPostalCode"));
      this.checkInputConstraints("phone", this.byId("inputPhoneNumber"));
      this.checkInputConstraints("birthDate", this.byId("inputBirthDate"));


      // Verificar si hay errores
      const aMessages = oMessageManager.getMessageModel().getData();
      const bHasErrors = aMessages.some(m => m.type === "Error");
      const bHasRelevant = aMessages.some(m => m.type === "Error" || m.type === "Warning");

      const oButton = this.byId("messagePopoverButton");
      if (oButton && bHasRelevant) {
        oButton.setType(this.mpTypeFormatter());
        oButton.setIcon(this.mpIconFormatter());
        oButton.setText(this.mpSeverityMessages());
      }

      if (bHasErrors) {
        MessageToast.show(this.getText("formErrorsToast"));

        return;
      }

      // guardar, si no hay errores
      // Obtener datos del usuario actual
      const oUserData = oView.getModel("user").getData();
      const oNewUser = JSON.parse(JSON.stringify(oUserData));
      oNewUser.personal.fullName = oNewUser.personal.firstName + " " + oNewUser.personal.lastName;


      // Obtener modelo de usuarios y agregar el nuevo
      const oUsuariosModel = oView.getModel("usuarios");
      const aUsuarios = oUsuariosModel.getData();
      //  console.log("Postal antes de guardar:", oNewUser.address.postalCode);
      aUsuarios.push(oNewUser);
      oUsuariosModel.setData(aUsuarios);
      oUsuariosModel.refresh(true);

      MessageToast.show(this.getText("userSavedToast"));

      // Limpiar el formulario
      this.onCancelar();
    },

    onItemPress: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oUser = oItem.getBindingContext("usuarios").getObject();

      const sTypeDocumentText = this.translateTypeDocument(oUser.personal.typeDocument);
      const sPlaceBirthText = this.translatePlaceBirth(oUser.other.placeBirth);
      const sNationalityText = this.translateNationality(oUser.other.nationality);
      const sGenreText = this.translateGenre(oUser.other.genre);
      const sCivilText = this.translateCivilStatus(oUser.other.civilStatus);
      const sCountryText = this.translateCountry(oUser.address.country);
      const sProvinceText = this.translateProvince(oUser.address.province);
      const sRegionText = this.translateRegion(oUser.address.region);


      const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance();
      const sFormattedDate = oDateFormat.format(new Date(oUser.personal.birthDate));

      const oDialog = new sap.m.Dialog({
        title: this.getText("dialogTitle"),
        contentWidth: "750px",
        content: new sap.ui.layout.form.SimpleForm({
          editable: false,
          layout: "ColumnLayout",
          columnsXL: 2,
          columnsL: 2,
          columnsM: 2,
          content: [
            new sap.ui.core.Title({ text: this.getText("sectionPersonal") }),
            new sap.m.Label({ text: this.getText("fullNameLabel") }),
            new sap.m.Text({ text: oUser.personal.fullName }),
            new sap.m.Label({ text: this.getText("typeDocumentLabel") }),
            new sap.m.Text({ text: sTypeDocumentText }),
            new sap.m.Label({ text: this.getText("documentNumberLabel") }),
            new sap.m.Text({ text: oUser.personal.numberDocument }),
            new sap.m.Label({ text: this.getText("birthDateLabel") }),
            new sap.m.Text({ text: sFormattedDate }),

            new sap.ui.core.Title({ text: this.getText("sectionOther") }),
            new sap.m.Label({ text: this.getText("placeBirthLabel") }),
            new sap.m.Text({ text: sPlaceBirthText }),
            new sap.m.Label({ text: this.getText("nationalityLabel") }),
            new sap.m.Text({ text: sNationalityText }),
            new sap.m.Label({ text: this.getText("genderLabel") }),
            new sap.m.Text({ text: sGenreText }),
            new sap.m.Label({ text: this.getText("civilStatusLabel") }),
            new sap.m.Text({ text: sCivilText }),

            new sap.ui.core.Title({ text: this.getText("sectionAddress") }),
            new sap.m.Label({ text: this.getText("countryLabel") }),
            new sap.m.Text({ text: sCountryText }),
            new sap.m.Label({ text: this.getText("provinceLabel") }),
            new sap.m.Text({ text: sProvinceText }),
            new sap.m.Label({ text: this.getText("regionLabel") }),
            new sap.m.Text({ text: sRegionText }),
            new sap.m.Label({ text: this.getText("addressLabel") }),
            new sap.m.Text({ text: oUser.address.address }),
            new sap.m.Label({ text: this.getText("postalCodeLabel") }),
            new sap.m.Text({ text: oUser.address.postalCode }),

            new sap.ui.core.Title({ text: this.getText("sectionContact") }),
            new sap.m.Label({ text: this.getText("phoneLabel") }),
            new sap.m.Text({ text: oUser.contact.phoneNumber }),
            new sap.m.Label({ text: this.getText("emailLabel") }),
            new sap.m.Text({ text: oUser.contact.email })
          ]
        }),
        beginButton: new sap.m.Button({
          text: this.getText("closeButtonLabel"),
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    getText: function (sKey) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
    },

    onCancelar: function () {
      const oView = this.getView();
      const oUserModel = oView.getModel("user");

      // Recargar el modelo JSON desde el archivo original
      oUserModel.loadData("./model/userModel.json", null, false);

      // Limpiar estados visuales de los campos
      const aControls = oView.getControlsByFieldGroupId("formFields");
      aControls.forEach(oControl => {
        if (oControl.setValueState) {
          oControl.setValueState("None");
        }
      });

      // Eliminar todos los mensajes del MessageManager
      this._MessageManager.removeAllMessages();

      if (this._oMessagePopover && this._oMessagePopover.isOpen()) {
        this._oMessagePopover.close();
      }

      // Poner el foco en el primer campo del formulario
      this.byId("inputFirstName").focus();
    },

    translateDomain: function (sKey, sPrefix) {
      if (!sKey || !sPrefix) return "";
      const oBundle = this.getView().getModel("i18n")?.getResourceBundle();
      return oBundle ? oBundle.getText(`${sPrefix}_${sKey}`) : sKey;
    },

    formatBirthDate: function (sDate) {
      if (!sDate) return "";

      const oDate = new Date(sDate);
      const oFormatter = sap.ui.core.format.DateFormat.getDateInstance();

      return oFormatter.format(oDate);
    },
    translateTypeDocument: function (sKey) {
      return this.translateDomain(sKey, "typeDocument");
    },

    translateGenre: function (sKey) {
      return this.translateDomain(sKey, "genre");
    },

    translateCivilStatus: function (sKey) {
      return this.translateDomain(sKey, "civilStatus");
    },

    translateNationality: function (sKey) {
      return this.translateDomain(sKey, "nationality");
    },

    translatePlaceBirth: function (sKey) {
      return this.translateDomain(sKey, "placeBirth");
    },

    translateCountry: function (sKey) {
      return this.translateDomain(sKey, "country");
    },

    translateProvince: function (sKey) {
      return this.translateDomain(sKey, "province");
    },

    translateRegion: function (sKey) {
      return this.translateDomain(sKey, "region");
    }

  });
});