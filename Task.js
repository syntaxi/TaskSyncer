const {defaults} = require("./config.json");
const {fields} = require('./Globals');

class Task {
    constructor() {
        this.fields = {};
        for (let field in fields) {
            if (fields.hasOwnProperty(field)) {
                this.fields[fields[field]] = null;
            }
        }
        for (let defaultField in defaults) {
            if (defaults.hasOwnProperty(defaultField)) {
                this.fields[defaultField] = defaults[defaultField];
            }
        }

        this.updatedFields = new Set();
    }

    resetUpdatedFields() {
        this.updatedFields = new Set();
    }

    wasFieldUpdated(fieldId) {
        return this.updatedFields.has(fieldId);
    }

    /**
     * Only writes the value to the field if it considers it to not be "nothing".
     *
     * Ie, undefined, empty string, empty list and empty dict are all not written to the field.
     * All other values are written.
     *
     * THe exception to this is if the pre-existing value is null then the data is always written.
     *
     * @param fieldName The name of the field to write to
     * @param value The value to try and write
     */
    setIfData(fieldName, value) {
        if (this.getField(fieldName) !== null) {
            switch (typeof value) {
                case "undefined":
                    return; // This is nothing by default

                case "object":
                    if (Array.isArray(value) && value.length === 0 // Empty array
                        || Object.keys(value).length === 0 // Empty dict
                        || value == null) { // null
                        return;
                    } else {
                        break;
                    }
                case "string":
                    if (value === "") {
                        return; // Empty string
                    } else {
                        break;
                    }
            }
        }
        this.setField(fieldName, value);
    }

    /**
     * Sets a field to the value.
     * @param fieldName The name of the field to set
     * @param value The value to set it to
     */
    setField(fieldName, value) {
        if (this.fields.hasOwnProperty(fieldName)) {
            this.fields[fieldName] = value;
            this.updatedFields.add(fieldName)
        } else {
            throw new Error(`Attempted to set unknown field '${fieldName}' to value '${value}'`);
        }
    }

    getField(fieldName) {
        if (this.fields.hasOwnProperty(fieldName)) {
            return this.fields[fieldName];
        } else {
            throw new Error(`Attempted to get unknown field '${fieldName}'`);
        }
    }
}


module.exports = Task;