import * as ko from "knockout";
import * as Survey from "survey-knockout";
import { SurveyPropertyConditionEditor } from "./propertyEditors/propertyConditionEditor";
import { SurveyPropertyTriggersEditor } from "./propertyEditors/propertyTriggersEditor";
import { SurveyElementSelector } from "./propertyEditors/surveyElementSelector";
import { ISurveyObjectEditorOptions } from "./propertyEditors/propertyEditorBase";
import { editorLocalization } from "./editorLocalization";
import { stringLiteral } from "babel-types";

export interface ISurveyLogicType {
  name: string;
  baseClass: string;
  propertyName: string;
  templateName?: string;
  showInUI?: boolean;
  showIf?: (survey: Survey.SurveyModel) => boolean;
  createNewElement?: (survey: Survey.SurveyModel) => Survey.Base;
  saveElement?: (survey: Survey.SurveyModel, op: SurveyLogicOperation) => void;
  createTemplateObject?: (element: Survey.Base) => any;
  isUniqueItem?: boolean;
  questionNames?: Array<string>;
  getDisplayText?: (element: Survey.Base, formatStr: string) => string;
  getDisplayTextName?: (element: Survey.Base) => string;
}

function getLogicString(name: string) {
  return editorLocalization.getString("ed.lg." + name);
}

export class SurveyLogicType {
  public static formatElName(name: string): string {
    return "{" + name + "}";
  }
  private hasUniqueItem: boolean = false;
  public koVisible: any;
  constructor(
    private logicType: ISurveyLogicType,
    public survey: Survey.SurveyModel,
    public options: ISurveyObjectEditorOptions = null
  ) {
    this.koVisible = ko.observable(true);
    this.update();
  }
  public get name(): string {
    return this.logicType.name;
  }
  public get baseClass(): string {
    return this.logicType.baseClass;
  }
  public get propertyName(): string {
    return this.logicType.propertyName;
  }
  public get templateName(): string {
    if (this.isTrigger) return "propertyeditorcontent-trigger-content";
    return !!this.logicType.templateName
      ? this.logicType.templateName
      : "elementselector";
  }
  public update(operations: Array<SurveyLogicOperation> = null) {
    this.hasUniqueItem = this.isUniqueItem && this.hasThisOperation(operations);
    this.koVisible(this.visible);
  }
  public get visible(): boolean {
    if (!this.showInUI) return false;
    if (this.hasUniqueItem) return false;
    if (!!this.logicType.showIf) return this.logicType.showIf(this.survey);
    return true;
  }
  public get showTitlesInExpression(): boolean {
    return !!this.options && this.options.showTitlesInExpressions;
  }
  public get hasItemSelector(): boolean {
    return !!this.baseClass && this.showInUI && !this.canCreateNewElement();
  }
  public createItemSelector(): SurveyElementSelector {
    if (!this.hasItemSelector) return null;
    var res = new SurveyElementSelector(
      this.survey,
      this.baseClass,
      this.showTitlesInExpression
    );
    res.disabledPropertyName = this.propertyName;
    return res;
  }
  public get showInUI(): boolean {
    return this.logicType.showInUI !== false;
  }
  private canCreateNewElement(): boolean {
    return !!this.logicType.createNewElement || this.isTrigger;
  }
  private get isTrigger(): boolean {
    return !!this.baseClass && this.baseClass.indexOf("trigger") > -1;
  }
  public createNewElement(survey: Survey.SurveyModel): Survey.Base {
    if (!!this.logicType.createNewElement)
      return this.logicType.createNewElement(survey);
    if (this.isTrigger) return this.createTriggerElement(survey);
    return null;
  }
  public saveElement(op: SurveyLogicOperation): void {
    if (!!this.logicType.saveElement) {
      this.logicType.saveElement(this.survey, op);
    }
    if (this.isTrigger) {
      this.saveTriggerElement(op);
    }
  }
  public createTemplateObject(element: Survey.Base): any {
    if (!!this.logicType.createTemplateObject)
      return this.logicType.createTemplateObject(element);
    if (this.isTrigger) return this.createTriggerTemplateObject(element);
    return null;
  }
  public get isUniqueItem(): boolean {
    return this.logicType.isUniqueItem === true;
  }
  public get questionNames(): Array<string> {
    return this.logicType.questionNames;
  }
  public get displayName(): string {
    return getLogicString(this.name + "Name");
  }
  public get description(): string {
    return getLogicString(this.name + "Description");
  }
  public getDisplayText(element: Survey.Base): string {
    var str = getLogicString(this.name + "Text");
    if (!!this.logicType.getDisplayText)
      return this.logicType.getDisplayText(element, str);
    var name = "";
    if (!!this.logicType.getDisplayTextName) {
      name = this.logicType.getDisplayTextName(element);
    } else {
      if (!!element && !!element["name"]) {
        name = element["name"];
      }
    }
    if (!!name) {
      return str["format"](SurveyLogicType.formatElName(name));
    }
    return str;
  }
  private hasThisOperation(operations: Array<SurveyLogicOperation>): boolean {
    if (!operations) return false;
    for (var i = 0; i < operations.length; i++) {
      if (operations[i].logicType == this) return true;
    }
    return false;
  }
  private createTriggerElement(survey: Survey.SurveyModel): Survey.Base {
    var res = <Survey.SurveyTrigger>(
      Survey.Serializer.createClass(this.baseClass)
    );
    res["survey"] = survey;
    res.setOwner(survey);
    return res;
  }
  private saveTriggerElement(op: SurveyLogicOperation) {
    var trigger = <Survey.SurveyTrigger>op.element;
    op.templateObject.applyProperties(trigger);
    var survey = this.survey;
    if (
      !!survey &&
      survey.triggers.indexOf(trigger) < 0 &&
      !!trigger.expression
    ) {
      survey.triggers.push(trigger);
    }
  }
  private createTriggerTemplateObject(element: Survey.Base) {
    return SurveyPropertyTriggersEditor.createTriggerEditor(
      this.survey,
      <Survey.SurveyTrigger>element,
      this.options
    );
  }
}

export class SurveyLogicOperation {
  public koElement: any;
  private templateObjectValue: any;
  private itemSelectorValue: SurveyElementSelector = null;
  constructor(public logicType: SurveyLogicType, element: Survey.Base) {
    this.koElement = ko.observable(element);
    this.itemSelectorValue = this.logicType.createItemSelector();
    if (this.itemSelector) {
      var self = this;
      this.itemSelector.element = element;
      this.itemSelector.onValueChangedCallback = function(newValue: string) {
        self.element = self.itemSelector.element;
      };
    }
    this.templateObjectValue = logicType.createTemplateObject(this.element);
  }
  public get template(): string {
    return this.logicType.templateName;
  }
  public get templateObject(): any {
    return !!this.templateObjectValue
      ? this.templateObjectValue
      : this.itemSelector;
  }
  public get element(): Survey.Base {
    return this.koElement();
  }
  public set element(val: Survey.Base) {
    this.koElement(val);
  }
  public get itemSelector(): SurveyElementSelector {
    return this.itemSelectorValue;
  }
  public apply(expression: string, isRenaming: boolean = false) {
    if (!!this.element) {
      this.element[this.logicType.propertyName] = expression;
      if (!isRenaming) {
        this.logicType.saveElement(this);
      }
    }
  }
  public renameQuestion(oldName: string, newName: string) {
    if (!this.element) return;
    var names = this.questionNames;
    for (var i = 0; i < names.length; i++) {
      var str = this.element[names[i]];
      if (!!str && str.toLowerCase() == oldName.toLowerCase()) {
        this.element[names[i]] = newName;
      }
    }
  }
  public equals(op: SurveyLogicOperation): boolean {
    return this.logicType === op.logicType && this.element === op.element;
  }
  public get name(): string {
    return this.logicType.displayName;
  }
  public get text(): string {
    return this.logicType.getDisplayText(this.element);
  }
  public get deleteOperationText(): string {
    return getLogicString("deleteOperation");
  }
  public hasError(): boolean {
    if (!!this.itemSelector) return this.itemSelector.hasError();
    if (!!this.templateObject && !!this.templateObject.hasError)
      return this.templateObject.hasError();
    return false;
  }
  private get questionNames(): Array<string> {
    if (!this.logicType.questionNames) return [];
    return this.logicType.questionNames;
  }
}

export interface ISurveyLogicItemOwner {
  readOnly: boolean;
  editItem(item: SurveyLogicItem);
  removeItem(item: SurveyLogicItem);
}

export class SurveyLogicItem {
  public koOperations: any;
  private static counter = 0;
  private id = ++SurveyLogicItem.counter;
  private removedOperations: Array<SurveyLogicOperation>;
  constructor(
    private owner: ISurveyLogicItemOwner,
    public expression: string = ""
  ) {
    this.removedOperations = [];
    this.koOperations = ko.observableArray();
  }
  public get name() {
    return "logicItem" + this.id;
  }
  public get title() {
    var res = this.expression;
    if (!!res && res.length > 50) {
      res = res.substr(1, 50) + "...";
    }
    return res;
  }
  public edit() {
    if (!!this.owner) {
      this.owner.editItem(this);
    }
  }
  public remove() {
    if (!!this.owner) {
      this.owner.removeItem(this);
    }
  }
  public get isReadOnly() {
    return !!this.owner && this.owner.readOnly;
  }
  public get operations(): Array<SurveyLogicOperation> {
    return this.koOperations();
  }
  public addOperation(
    lt: SurveyLogicType,
    element: Survey.Base = null
  ): SurveyLogicOperation {
    var op = new SurveyLogicOperation(lt, element);
    this.koOperations.push(op);
    lt.update(this.operations);
    return op;
  }
  public removeOperation(op: SurveyLogicOperation) {
    this.removedOperations.push(op);
    var index = this.koOperations().indexOf(op);
    if (index > -1) {
      this.koOperations.splice(index, 1);
      if (!!op.logicType) {
        op.logicType.update(this.operations);
      }
    }
  }
  public apply(expression: string) {
    this.removeSameOperations();
    for (var i = 0; i < this.removedOperations.length; i++) {
      this.removedOperations[i].apply("");
    }
    this.removedOperations = [];
    this.applyExpression(expression, false);
  }
  public renameQuestion(oldName: string, newName: string) {
    if (!oldName || !newName) return;
    this.renameQuestionInExpression(oldName, newName);
    var ops = this.operations;
    for (var i = 0; i < ops.length; i++) {
      ops[i].renameQuestion(oldName, newName);
    }
  }
  public get expressionText(): string {
    return editorLocalization
      .getString("ed.lg.itemExpressionText")
      ["format"](this.expression);
  }
  public get editText(): string {
    return editorLocalization.getString("pe.edit");
  }
  public get deleteText(): string {
    return editorLocalization.getString("pe.delete");
  }
  private renameQuestionInExpression(oldName: string, newName: string) {
    if (!this.expression) return;
    var newExpression = this.expression;
    var expression = this.expression.toLocaleLowerCase();
    oldName = "{" + oldName.toLowerCase() + "}";
    newName = "{" + newName + "}";
    var index = expression.lastIndexOf(oldName, expression.length);
    while (index > -1) {
      newExpression =
        newExpression.substring(0, index) +
        newName +
        newExpression.substr(index + oldName.length, +newExpression.length);
      expression = expression.substring(0, index);
      index = expression.lastIndexOf(oldName, expression.length);
    }
    if (newExpression != this.expression) {
      this.applyExpression(newExpression, true);
    }
  }
  private applyExpression(expression: string, isRenaming: boolean) {
    this.expression = expression;
    var ops = this.operations;
    for (var i = 0; i < ops.length; i++) {
      ops[i].apply(expression, isRenaming);
    }
  }
  private removeSameOperations() {
    var ops = this.operations;
    for (var i = ops.length - 1; i >= 0; i--) {
      for (var j = i - 1; j >= 0; j--) {
        if (ops[i].equals(ops[j])) {
          this.removeOperation(ops[i]);
          break;
        }
      }
    }
  }
}

export class SurveyLogic implements ISurveyLogicItemOwner {
  private static hasNeededElements(
    elements: Array<any>,
    propName: string
  ): boolean {
    if (!elements || !Array.isArray(elements)) return false;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el[propName]) {
        return true;
      }
    }
    return false;
  }
  public static types = [
    {
      name: "page_visibility",
      baseClass: "page",
      propertyName: "visibleIf",
      showIf: function(survey: Survey.SurveyModel) {
        return (
          survey.pages.length > 1 &&
          SurveyLogic.hasNeededElements(survey.pages, "visibleIf")
        );
      }
    },
    {
      name: "panel_visibility",
      baseClass: "panel",
      propertyName: "visibleIf",
      showIf: function(survey: Survey.SurveyModel) {
        return SurveyLogic.hasNeededElements(
          survey.getAllPanels(),
          "visibleIf"
        );
      }
    },
    {
      name: "panel_enable",
      baseClass: "panel",
      propertyName: "enableIf",
      showIf: function(survey: Survey.SurveyModel) {
        return SurveyLogic.hasNeededElements(survey.getAllPanels(), "enableIf");
      }
    },
    {
      name: "question_visibility",
      baseClass: "question",
      propertyName: "visibleIf",
      showIf: function(survey: Survey.SurveyModel) {
        return SurveyLogic.hasNeededElements(
          survey.getAllQuestions(),
          "visibleIf"
        );
      }
    },
    {
      name: "question_enable",
      baseClass: "question",
      propertyName: "enableIf",
      showIf: function(survey: Survey.SurveyModel) {
        return SurveyLogic.hasNeededElements(
          survey.getAllQuestions(),
          "enableIf"
        );
      }
    },
    {
      name: "question_require",
      baseClass: "question",
      propertyName: "requiredIf",
      showIf: function(survey: Survey.SurveyModel) {
        return SurveyLogic.hasNeededElements(
          survey.getAllQuestions(),
          "requiredIf"
        );
      }
    },
    {
      name: "expression_expression",
      baseClass: "expression",
      propertyName: "expression",
      showInUI: false
    },
    {
      name: "matrixdropdowncolumn_visibleIf",
      baseClass: "matrixdropdowncolumn",
      propertyName: "visibleIf",
      showInUI: false
    },
    {
      name: "matrixdropdowncolumn_enableIf",
      baseClass: "matrixdropdowncolumn",
      propertyName: "enableIf",
      showInUI: false
    },
    {
      name: "matrixdropdowncolumn_requiredIf",
      baseClass: "matrixdropdowncolumn",
      propertyName: "requiredIf",
      showInUI: false
    },
    {
      name: "matrixdropdowncolumn_totalExpression",
      baseClass: "matrixdropdowncolumn",
      propertyName: "totalExpression",
      showInUI: false
    },
    {
      name: "trigger_complete",
      baseClass: "completetrigger",
      propertyName: "expression",
      isUniqueItem: true
    },
    {
      name: "trigger_setvalue",
      baseClass: "setvaluetrigger",
      propertyName: "expression",
      questionNames: ["setToName"],
      getDisplayText: function(
        element: Survey.Base,
        formatStr: string
      ): string {
        return formatStr["format"](
          SurveyLogicType.formatElName(element["setToName"]),
          element["setValue"]
        );
      }
    },
    {
      name: "trigger_copyvalue",
      baseClass: "copyvaluetrigger",
      propertyName: "expression",
      questionNames: ["setToName", "fromName"],
      getDisplayText: function(
        element: Survey.Base,
        formatStr: string
      ): string {
        return formatStr["format"](
          SurveyLogicType.formatElName(element["setToName"]),
          SurveyLogicType.formatElName(element["fromName"])
        );
      }
    },
    {
      name: "trigger_skip",
      baseClass: "skiptrigger",
      propertyName: "expression",
      questionNames: ["gotoName"],
      isUniqueItem: true,
      getDisplayTextName: function(element: Survey.Base): string {
        return element["gotoName"];
      }
    },
    {
      name: "trigger_runExpression",
      baseClass: "runexpressiontrigger",
      propertyName: "expression",
      questionNames: ["setToName"],
      getDisplayText: function(
        element: Survey.Base,
        formatStr: string
      ): string {
        var res = getLogicString("trigger_runExpressionText1");
        res = res["format"](element["runExpression"]);
        var setToName = element["setToName"];
        if (!!setToName) {
          var str = getLogicString("trigger_runExpressionText2");
          res += str["format"](
            SurveyLogicType.formatElName(element["setToName"])
          );
        }
        return res;
      }
    },
    {
      name: "completedHtmlOnCondition",
      baseClass: "htmlconditionitem",
      propertyName: "expression",
      isUniqueItem: true,
      templateName: "propertyeditorcontent-html",
      createNewElement: function(survey: Survey.SurveyModel) {
        return new Survey.HtmlConditionItem();
      },
      createTemplateObject: function(element: Survey.Base) {
        var item = <Survey.HtmlConditionItem>element;
        return { koValue: ko.observable(item.html), readOnly: false };
      },
      saveElement: function(
        survey: Survey.SurveyModel,
        op: SurveyLogicOperation
      ) {
        var item = <Survey.HtmlConditionItem>op.element;
        item.html = op.templateObject.koValue();
        if (survey.completedHtmlOnCondition.indexOf(item) < 0) {
          survey.completedHtmlOnCondition.push(item);
        }
      }
    },
    {
      name: "trigger_runExpression_Expression",
      baseClass: "runexpressiontrigger",
      propertyName: "runExpression",
      showInUI: false
    },
    {
      name: "question_expressionValidator",
      baseClass: "expressionvalidator",
      propertyName: "expression",
      showInUI: false
    },
    {
      name: "matrix_rowsVisibleIf",
      baseClass: "matrix",
      propertyName: "rowsVisibleIf",
      showInUI: false
    },
    {
      name: "matrix_columnsVisibleIf",
      baseClass: "matrix",
      propertyName: "columnsVisibleIf",
      showInUI: false
    },
    {
      name: "matrixdropdown_rowsVisibleIf",
      baseClass: "matrixdropdown",
      propertyName: "rowsVisibleIf",
      showInUI: false
    },
    {
      name: "select_choicesVisibleIf",
      baseClass: "selectbase",
      propertyName: "choicesVisibleIf",
      showInUI: false
    },
    {
      name: "select_choicesEnableIf",
      baseClass: "selectbase",
      propertyName: "choicesEnableIf",
      showInUI: false
    },
    {
      name: "itemvalue_visibleIf",
      baseClass: "itemvalue",
      propertyName: "visibleIf",
      showInUI: false
    },
    {
      name: "itemvalue_enableIf",
      baseClass: "itemvalue",
      propertyName: "enableIf",
      showInUI: false
    },
    {
      name: "calculatedValue",
      baseClass: "calculatedvalue",
      propertyName: "expression",
      showInUI: false
    }
  ];
  public koItems: any;
  public invisibleItems: Array<SurveyLogicItem> = [];
  public koLogicTypes: any;
  public koMode: any;
  public koAddNew: any;
  public koEditItem: any;
  public koRemoveItem: any;
  public koShowView: any;
  public koSaveAndShowView: any;
  public koSaveEditableItem: any;
  public koAddNewOperation: any;
  public koRemoveOperation: any;
  public koEditableItem: any;
  public expressionEditor: SurveyPropertyConditionEditor;
  public koReadOnly: any;
  public koErrorText: any;
  public koDisplayError: any;
  public onChangedCallback: (item: SurveyLogicItem, changeType: string) => void;

  constructor(
    public survey: Survey.SurveyModel,
    public options: ISurveyObjectEditorOptions = null
  ) {
    this.createExpressionPropertyEditor();
    this.koItems = ko.observableArray();
    this.koLogicTypes = ko.observableArray();
    this.koMode = ko.observable("view");
    this.koReadOnly = ko.observable(this.readOnly);
    this.koErrorText = ko.observable("");
    var self = this;
    this.koDisplayError = ko.computed(function() {
      return !!self.koErrorText();
    });
    this.koAddNew = function() {
      self.addNew();
    };
    this.koEditItem = function(item: SurveyLogicItem) {
      self.editItem(item);
    };
    this.koRemoveItem = function(item: SurveyLogicItem) {
      self.removeItem(item);
    };
    this.koShowView = function() {
      self.mode = "view";
    };
    this.koSaveAndShowView = function() {
      if (self.saveEditableItem()) {
        self.mode = "view";
      }
    };
    this.koSaveEditableItem = function() {
      self.saveEditableItem();
    };
    this.koAddNewOperation = function(logicType: SurveyLogicType) {
      self.addNewOperation(logicType);
    };
    this.koRemoveOperation = function(op: SurveyLogicOperation) {
      self.removeOperation(op);
    };
    this.koEditableItem = ko.observable(null);
    this.update();
  }
  public getTypeByName(name: string): SurveyLogicType {
    for (var i = 0; i < this.logicTypes.length; i++) {
      if (this.logicTypes[i].name == name) return this.logicTypes[i];
    }
    return null;
  }
  public update(
    survey: Survey.SurveyModel = null,
    options: ISurveyObjectEditorOptions = null
  ) {
    if (!!survey) {
      this.survey = survey;
    }
    if (!!options) {
      this.options = options;
    }
    this.koLogicTypes(this.createLogicTypes());
    this.updateVisibleItems();
    this.invisibleItems = this.buildItems(false);
    this.koReadOnly(this.readOnly);
    this.mode = "view";
    this.expressionEditor.object = this.survey;
    this.expressionEditor.options = this.options;
    this.expressionEditor.displayName = getLogicString("expressionEditorTitle");
    this.expressionEditor.showHelpText = false;
    this.expressionEditor.beforeShow();
  }
  private updateVisibleItems() {
    this.koItems(this.buildItems(true));
    this.koEditableItem(null);
    this.koErrorText("");
  }
  public get readOnly() {
    return !!this.options && this.options.readOnly;
  }
  public saveEditableItem(): boolean {
    if (!this.editableItem || this.hasError()) return false;
    this.expressionEditor.apply();
    this.editableItem.apply(this.expressionEditor.editingValue);
    var isNew = this.koItems.indexOf(this.editableItem) < 0;
    if (isNew) {
      this.koItems.push(this.editableItem);
    }
    this.onItemChanged(this.editableItem, isNew ? "new" : "modify");
    return true;
  }
  protected onItemChanged(item: SurveyLogicItem, changeType: string) {
    if (!!this.onChangedCallback) {
      this.onChangedCallback(item, changeType);
    }
  }
  public get items(): Array<SurveyLogicItem> {
    return this.koItems();
  }
  public get logicTypes(): Array<SurveyLogicType> {
    return this.koLogicTypes();
  }
  public get editableItem(): SurveyLogicItem {
    return this.koEditableItem();
  }
  public renameQuestion(oldName: string, newName: string) {
    this.renameQuestionCore(oldName, newName, this.items);
    this.renameQuestionCore(oldName, newName, this.invisibleItems);
  }
  public hasError(): boolean {
    if (!this.editableItem) return false;
    var text = "";
    if (!this.isExpressionValid) {
      text = getLogicString("expressionInvalid");
    }
    var ops = this.editableItem.operations;
    if (!text && ops.length == 0) {
      text = getLogicString("noOperationError");
    }
    if (!text) {
      for (var i = 0; i < ops.length; i++) {
        if (ops[i].hasError()) {
          text = getLogicString("operationInvalid");
        }
      }
    }
    this.koErrorText(text);
    return !!text;
  }
  public get addNewOperationText(): string {
    return getLogicString("addNewOperation");
  }
  private get isExpressionValid(): boolean {
    return this.expressionEditor.isExpressionValid;
  }
  private renameQuestionCore(
    oldName: string,
    newName: string,
    items: Array<SurveyLogicItem>
  ) {
    for (var i = 0; i < items.length; i++) {
      items[i].renameQuestion(oldName, newName);
    }
  }

  /**
   * There are 3 modes: view, new, edit
   */
  public get mode() {
    return this.koMode();
  }
  public set mode(val: string) {
    if (val !== "view" && val !== "new" && val !== "edit") return;
    if (this.mode == val) return;
    var oldMode = this.mode;
    if (val == "new" || val == "edit") {
      this.updateLogicTypes();
    }
    if ((oldMode == "new" || oldMode == "edit") && val == "view") {
      this.updateVisibleItems();
    }
    this.koMode(val);
  }
  public addNew() {
    this.koEditableItem(new SurveyLogicItem(this));
    this.expressionEditor.editingValue = "";
    this.mode = "new";
  }
  public editItem(item: SurveyLogicItem) {
    this.koEditableItem(item);
    this.expressionEditor.editingValue = item.expression;
    this.mode = "edit";
  }
  public removeItem(item: SurveyLogicItem) {
    item.apply("");
    var index = this.koItems.indexOf(item);
    if (index > -1) {
      this.koItems.splice(index, 1);
    }
    this.onItemChanged(item, "delete");
  }
  public addNewOperation(logicType: SurveyLogicType): SurveyLogicOperation {
    var element = logicType.createNewElement(this.survey);
    return this.editableItem.addOperation(logicType, element);
  }
  public removeOperation(op: SurveyLogicOperation) {
    this.editableItem.removeOperation(op);
  }
  protected buildItems(showInUI: boolean): Array<SurveyLogicItem> {
    var res = [];
    var hash = {};
    var elements = this.getAllElements();
    for (var i = 0; i < elements.length; i++) {
      this.buildItemsByElement(elements[i], res, hash, showInUI);
    }
    return res;
  }
  protected getAllElements(): Array<Survey.Base> {
    var res = [];
    this.AddElements(this.survey.pages, res);
    this.AddElements(this.survey.getAllQuestions(), res);
    this.AddElements(this.survey.getAllPanels(), res);
    this.AddElements(this.survey.triggers, res);
    this.AddElements(this.survey.completedHtmlOnCondition, res);
    this.AddElements(this.survey.calculatedValues, res);
    this.AddElements(this.getMatrixColumns(), res);
    this.AddElements(this.getValidators(), res);
    this.AddElements(this.getItemValues(), res);
    return res;
  }
  private getMatrixColumns(): Array<Survey.Base> {
    var res = [];
    var questions = this.survey.getAllQuestions();
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var columns = q["columns"];
      if (!columns) continue;
      var prop = Survey.Serializer.findProperty(q.getType(), "columns");
      if (!prop || prop.className !== "matrixdropdowncolumn") continue;
      this.AddElements(columns, res);
    }
    return res;
  }
  private getValidators(): Array<Survey.Base> {
    var res = [];
    var questions = this.survey.getAllQuestions();
    for (var i = 0; i < questions.length; i++) {
      this.AddElements((<Survey.Question>questions[i]).validators, res);
    }
    return res;
  }
  private getItemValues(): Array<Survey.Base> {
    var res = [];
    var questions = this.survey.getAllQuestions();
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var choices = q["choices"];
      if (!choices) continue;
      var prop = Survey.Serializer.findProperty(q.getType(), "choices");
      if (!prop || prop.type !== "itemvalue[]") continue;
      this.AddElements(choices, res);
    }
    return res;
  }
  private updateLogicTypes() {
    var lts = this.logicTypes;
    for (var i = 0; i < lts.length; i++) {
      lts[i].update();
    }
  }
  private AddElements(src: Array<any>, dest: Array<any>) {
    for (var i = 0; i < src.length; i++) {
      dest.push(src[i]);
    }
  }
  private buildItemsByElement(
    element: Survey.Base,
    dest: Array<SurveyLogicItem>,
    hash: Survey.HashTable<SurveyLogicItem>,
    showInUI: boolean
  ) {
    var types = this.getElementAllTypes(element);
    for (var i = 0; i < this.logicTypes.length; i++) {
      var lt = this.logicTypes[i];
      if (lt.showInUI !== showInUI) continue;
      var expression = element[lt.propertyName];
      if (
        types.indexOf(lt.baseClass) > -1 &&
        !Survey.Helpers.isValueEmpty(expression)
      ) {
        var key = this.getExpressionHashKey(expression);
        var item = hash[key];
        if (!item) {
          item = new SurveyLogicItem(this, expression);
          hash[key] = item;
          dest.push(item);
        }
        item.addOperation(lt, element);
      }
    }
  }
  private getExpressionHashKey(expression: string): string {
    return expression.replace(" ", "").toLowerCase();
  }
  private getElementAllTypes(element: Survey.Base) {
    var types = [];
    var type = element.getType();
    types.push(type);
    while (!!type && type != "base") {
      var cl = Survey.Serializer.findClass(type);
      if (!cl) break;
      type = cl.parentName;
      if (!!type) {
        types.push(type);
      }
    }
    return types;
  }
  protected createLogicTypes(): Array<SurveyLogicType> {
    var res = [];
    for (var i = 0; i < SurveyLogic.types.length; i++) {
      res.push(
        new SurveyLogicType(SurveyLogic.types[i], this.survey, this.options)
      );
    }
    return res;
  }
  private getExpressionProperty(): Survey.JsonObjectProperty {
    var property = Survey.Serializer.findProperty("survey", "hiddenLogic");
    if (!!property) return property;
    Survey.Serializer.addProperty("survey", {
      name: "hiddenLogic:condition",
      visible: false,
      isSerializable: false
    });
    return Survey.Serializer.findProperty("survey", "hiddenLogic");
  }
  private createExpressionPropertyEditor() {
    this.expressionEditor = new SurveyPropertyConditionEditor(
      this.getExpressionProperty()
    );
    this.expressionEditor.object = this.survey;
  }
}
