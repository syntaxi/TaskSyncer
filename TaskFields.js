/**
 * Represents a single field on a task.
 * There are two child classes depending on the location of the data in trello
 *
 * @see BasicTaskField
 * @see CustomTaskField
 */
class TaskField {
    /**
     * Loads up the google elements of the task field
     *
     *
     * @param googleParser {function|string} if it is a function, then that function should take in the full data payload
     *                  and return the value to set the field to. The current field value is also passed as an optional
     *                  second paramater
     * @param [googleWriter] {function}
     * @param [initialValue] {*} The initial value to set the field to. Default of null
     */
    constructor(googleParser, initialValue, googleWriter) {
        this.parseGoogle = this._buildParser(googleParser);
        this.outputGoogle = googleWriter ? googleWriter : this._buildWriter(googleParser);
        this.value = initialValue;
        this.wasUpdated = false;
        this.wasChanged = false;
    }

    /**
     * Handles converting the handler argument into the correct function type
     *
     * @param argument The handler argument
     * @return {function} A function that takes in the data and returns the value for this field
     */
    _buildParser(argument) {
        if (typeof argument === "string") {
            return data => data[argument];
        } else if (typeof argument === "function") {
            return argument;
        } else {
            throw new TypeError(`Field (${argument}) is not a String or Function`);
        }
    }

    /**
     * Handles converting the handler argument into the correct function type
     *
     * @param argument The handler argument
     * @return {function} A function that takes in the data and returns the data with this field added
     * @private
     */
    _buildWriter(argument) {
        if (typeof argument === "string") {
            return data => data[argument] = this.value;
        } else if (typeof argument === "function") {
            return argument;
        } else {
            throw new TypeError(`Field (${argument}) is not a String or Function`);
        }
    }

    /**
     * Loads the value for this field from the given data payload.
     * This calls the google handler as specified in the constructor
     *
     * @param data The raw google task payload
     */
    loadFromGoogle(data) {
        const newValue = this.parseGoogle(data, this.value);
        this.wasUpdated = true;
        this.wasChanged = newValue !== this.value;
        this.value = newValue;
    }

    /**
     * Loads the value for this field from the trello payload.
     * This payload varies depending on the subclasses for this class
     *
     * Blank, should be overridden.
     */
    loadFromTrello() {

    }

    /**
     * Adds this field to the google payload.
     *
     * @param data The current payload to send to google.
     */
    writeToGoogle(data) {
        return this.outputGoogle(data)
    }

    writeToTrello(data) {

    }

    /**
     * @return {*} The value contained in this field
     */
    getValue() {
        return this.value
    }

    /**
     * @param data The value to set this field to.
     */
    setValue(data) {
        this.value = data;
    }
}

/**
 * Represents a task field where the data is located in the main card payload.
 *
 * @see TaskField
 * @extends TaskField
 */
class BasicTaskField extends TaskField {
    /**
     * Loads in the trello field stuff and delegates the google fields to the super constructor
     * @param googleHandler {string|function} The google handler
     * @param trelloHandler {string} The key of the data in the payload.
     * @param [initialValue] {*} The initial value to set the field to. Defaults to null
     * @param [googleWriter] {function}
     */
    constructor(googleHandler, trelloHandler, initialValue, googleWriter) {
        super(googleHandler, initialValue, googleWriter);
        this.parseTrello = data => data[trelloHandler];
        this.trelloWriter = data => data[trelloHandler] = this.value;
    }

    /**
     * Loads the value for this field from the main card payload
     * @param data The card payload
     */
    loadFromTrello(data) {
        const newValue = this.parseTrello(data);
        this.wasUpdated = true;
        this.wasChanged = newValue !== this.value;
        this.value = newValue;
    }

    /**
     * Converts this field into a form to be sent to trello
     * @param data The object to store this field in
     */
    writeToTrello(data) {
        this.trelloWriter(data);
    }
}

/**
 * Represents a task field where the data is located in a custom field
 *
 * @see TaskField
 * @extends TaskField
 */
class CustomTaskField extends TaskField {
    /**
     * Loads in the trello field stuff and delegates the google fields to the super constructor
     *
     * @param googleHandler {string|function} The google handler
     * @param fieldId {string} The id of the custom field
     * @param trelloHandler {string|function} If a string, should be the type of the custom field data.
     *                      If a function, should take in the field payload and optionally the fields current value
     *                      and return the new value
     * @param [initialValue] {*} The initial value to set the field to. Defaults to null.
     * @param [googleWriter] {function}
     * @param [trelloWriter] {function}
     */
    constructor(googleHandler, fieldId, trelloHandler, initialValue, googleWriter, trelloWriter) {
        super(googleHandler, initialValue, googleWriter);
        this.fieldId = fieldId;
        this.type = typeof trelloHandler;
        this.parseTrello = this._buildTrelloParser(trelloHandler);
        this.trelloWriter = trelloWriter || (value => value)
    }

    /**
     * Converts the trello handler into an appropriate function
     *
     * @param trelloHandler
     * @return {function} The parsing function
     * @private
     */
    _buildTrelloParser(trelloHandler) {
        if (typeof trelloHandler === "string") {
            switch (trelloHandler) {
                case 'number':
                    return field => parseInt(field.number);
                case 'boolean':
                    return field => field.checked === 'true';
                case 'string':
                    return field => field.text;
                default:
                    throw new TypeError(`Type of trelloHandler (${trelloHandler}) was not known `)
            }
        } else if (typeof trelloHandler === 'function') {
            return trelloHandler;
        } else {
            throw new TypeError(`Field trelloHandler (${trelloHandler}) is not a String or Function`);
        }
    }

    /**
     * Called if the field was not set on the card. Handles the default value for the field
     * Useful for checkboxes where a 'false' value simply means the field doesn't show up
     */
    handleNotPresent() {
        if (this.type === 'boolean') {
            this.setValue(false);
            this.wasUpdated = true;
        }
    }

    /**
     * Checks if this matches a given custom field
     *
     * @param field {json} The full custom field payload to check against
     * @return {boolean} True if the given custom field matches this
     */
    doesFieldMatch(field) {
        return field.idCustomField === this.fieldId
    }

    /**
     * Loads the field data from the custom field payload
     *
     * @param field The full payload for the custom field.
     */
    loadFromTrello(field) {
        const newValue = this.parseTrello(field.value, this.value);
        this.wasUpdated = true;
        this.wasChanged = newValue !== this.value;
        this.value = newValue;
    }

    writeToTrello() {
        return this.trelloWriter(this.value)
    }

    /**
     * Converts this field to a string.
     * Simply gives the string version of the value
     *
     * @return {string} The string version of this fields data
     */
    toString() {
        return (this.value || "null").toString()
    }
}

module.exports = {
    TaskField: TaskField,
    BasicTaskField: BasicTaskField,
    CustomTaskField: CustomTaskField
};