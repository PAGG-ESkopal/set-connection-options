import {Mongo} from 'meteor/mongo';

import fs from 'fs';
import os from 'os';
/** @namespace process.env.SystemRoot */

class connectionOptions {
    constructor() {
        this.legalOptionNames = [
            'acceptableLatencyMS',
            'appname',
            'auto_reconnect',
            'autoReconnect',
            'bufferMaxEntries',
            'checkServerIdentity',
            'ciphers',
            'connectTimeoutMS',
            'domainsEnabled',
            'ecdhCurve',
            'emitError',
            'family',
            'ha',
            'haInterval',
            'keepAlive',
            'logger',
            'loggerLevel',
            'monitoring',
            'noDelay',
            'poolSize',
            'promoteBuffers',
            'promoteLongs',
            'promoteValues',
            'reconnectInterval',
            'reconnectTries',
            'servername',
            'socketOptions',
            'socketTimeoutMS',
            'ssl',
            'sslCA',
            'sslCert',
            'sslCRL',
            'sslKey',
            'sslPass',
            'sslValidate',
            'store'
        ];

        this.legalOptionAction = this.actionFoundOption.bind(this);

        // These options end up being used by NODEjs TLS facility
        //  below are the translations from Meteor to TLS
        this.translations = {
            // SSL translation options
            'sslCA': 'ca',
            'sslCert': 'cert',
            'sslCRL': 'crl',
            'sslKey': 'key',
            'sslPass': 'passphrase',
            'sslValidate': 'rejectUnauthorized',

            // SocketTimeout translation options

            'connectTimeoutMS': 'connectionTimeout',
            'socketTimeoutMS': 'socketTimeout',

            // Replicaset options

            'connectWithNoPrimary': 'secondaryOnlyConnectionAllowed',
            'replicaSet': 'setName',
            'rs_name': 'setName',
            'secondaryAcceptableLatencyMS': 'acceptableLatency',

            // Mongos options

            'acceptableLatencyMS': 'localThresholdMS'
        };

        // Warn user about any special settings that should not be used -- or only used in a particular way
        this.warningOptions = {
            'ssl': {
                warningText: 'Setting SSL here prevents using SSL and NON-SSL connections at the same time',
                warningAction: this.actionIgnore.bind(this),
            }
        };
        this.warningOptionAction = this.actionWarningOption.bind(this);

        this.internalOptions = {
            "debugLog": this.actionSetDebugLog.bind(this),      // Set our debugging flag first
            "options": this.actionSetOptions.bind(this),        // then read our options
            "default": this.actionFoundDefault.bind(this),      // then set the default

            "addOptionName": this.actionAddOptionName.bind(this),
            "filePath": this.actionSetOsSearchPath.bind(this),
            "osSearchPath": this.actionSetOsSearchPath.bind(this),
            "privatePath": this.actionSetPrivateSearchPath.bind(this),
            "privateSearchPath": this.actionSetPrivateSearchPath.bind(this),
            "searchPath": this.actionSetOsSearchPath.bind(this),
            "listOptions": this.actionListOptions.bind(this),
            "listInternal": this.actionListInternal.bind(this),
        };

        // Define a set of default options support SSL and X509 validation

        this.defaultConnectionOptionNamesLc = {
            'default': 'ssl',
            'none': 'none',
            'ssl': 'ssl',
            'sslx509': 'ssl',
        };

        this.defaultConnectionOptions = {
            'ssl': {
                sslCA: ["@caCert.pem"],     // Array of valid certificates for Certificate Authority either as Buffers or Strings.
                sslCert: "@clientCert.pem", // String or buffer containing the client certificate.
                sslCRL: [],                     // Array of revocation certificates as Buffers or Strings.
                sslKey: "@clientCert.pem",  // Optional private keys in PEM format.
                sslPass: null,                  // String or buffer containing the client certificate password.
                sslValidate: true,              // Validate server certificate against certificate authority.
            },
            'none': {},
        };

        this.filePrefixes = {
            '@': this.readFilePrivateOsSearch.bind(this),               // Read a file from our private folder then disk
        };

        // Allow the following prefixes with and without a leading '@'
        for (const [prefix, action] of Object.entries(
            {
                'both:': this.readFileOsPrivateSearch.bind(this),
                'diskOrPrivate': this.readFileOsPrivateSearch.bind(this),
                'env:': this.readEnv.bind(this),
                'file:': this.readFileOsSearch.bind(this),
                'internal:': this.readFilePrivateSearch.bind(this),
                'path:': this.readFilePath.bind(this),
                'private:': this.readFilePrivateSearch.bind(this),
                'privateOrDisk': this.readFilePrivateOsSearch.bind(this)
            })) {
            this.filePrefixes[prefix] = action;
            this.filePrefixes['@' + prefix] = action;
        }

        this.envPrefix = ['MONGO_SCO_', 'MONGO_CONNECTION_'];

        this.privateSearchPath = 'assets/app/';

        this.osSearchPath = "/etc/";

        const isWindows = os.platform() === 'win32';
        if (isWindows) {
            this.osSearchPath = process.env.SystemRoot + "\\system32\\drivers\\etc\\"
        }

        this.files = {};

        this.mongoEnv = {};

        this.connectionOptions = {};

        this.msgPrefix = 'set-connection-options --';
        this.msgPaddng = ' '.repeat(this.msgPrefix.length);

        this.noop = function () {};
        this.debugLog = this.noop.bind(this);

        this.actionSetDebugLog("false");     // Default to true;

        this.optionActions = {};
        this.ourOptionActions = {};

        this._initDebugLog();        // Setup our DebugLog based on user's request
        this._initActionTables();       // Create our action tables
    }

    /**
     * Create our Action tables
     */
    _initActionTables() {
        for (let optionName in this.internalOptions) {
            this.ourOptionActions[optionName.toLowerCase()] = {action: this.internalOptions[optionName], name: optionName};
        }
        this.legalOptionNames.forEach(optionName => {
            this.optionActions[optionName.toLowerCase()] = {action: this.legalOptionAction, name: optionName};
        });

        for (const [optionName, warningEntry] of Object.entries(this.warningOptions)) {
            this.optionActions[optionName.toLowerCase()] = {action: this.warningOptionAction, name: optionName};
        }
    }

    /**
     * Read env variables to retrieve our DEBUGLOG setting
     * @private
     */
    _initDebugLog() {
        const env = process.env;
        const envPrefix = [];
        this.envPrefix.forEach(prefix => {
            if (process.env[prefix + "DEBUGLOG"]) {
                this.actionSetDebugLog(process.env[prefix + "DEBUGLOG"], "debugLog", prefix + "DEBUGLOG");
            }
        });
    }

    /**
     * Read all the Mongo_ env variables into mongoEnv removing the MONGO_xxx prefix with lowercase names
     */
    _loadEnvValues() {
        this.debugLog(`${this.msgPrefix} Load Environmental Variables`);
        const env = process.env;
        const envPrefix = [];
        this.envPrefix.forEach(prefix => {
            envPrefix.push(prefix.toLowerCase())
        });

        for (let entry in env) {
            const entrylc = entry.toLowerCase();
            envPrefix.forEach(prefix => {
                if (entrylc.startsWith(prefix)) {
                    this.mongoEnv[entrylc.substr(prefix.length)] = {
                        key: entry,
                        name: entry.substr(prefix.length),
                        value: env[entry]
                    };
                }
            })
        }
        this.debugLog(`${this.msgPrefix} MongoEnv: ${JSON.stringify(this.mongoEnv, null, 4, 4)}`);
    }

    /**
     * Process each MONGO_ env variable that isn't one of OUR internal options
     */
    _processMongoEntries() {
        this.debugLog(`${this.msgPrefix} Process Environmental Variables`);
        for (const [key, mongoEntry] of Object.entries(this.mongoEnv)) {
            const optionName = mongoEntry.name;
            const optionNameLc = optionName.toLowerCase();
            if (!this.ourOptionActions[optionNameLc]) {
                // It's not one of our actions
                if (this.optionActions[optionNameLc]) {
                    this.optionActions[optionNameLc].action(mongoEntry.value, this.optionActions[optionNameLc].name, mongoEntry.key)
                } else {
                    error([
                              `${this.msgPrefix} invalid option '${optionName}' found in ${key}: '${mongoEntry.value}'`,
                              `${this.msgPaddng}   Value Ignored'`
                          ]);
                }
            }
        }
    }

    /**
     * Process each MONGO_ env variable that is one of OUR internal options
     */
    _processInternalActions() {
        this.debugLog(`${this.msgPrefix} Process Environmental Variables (Internal Only)`);
        for (const [optionName, optionAction] of Object.entries(this.ourOptionActions)) {
            const optionNameLc = optionName.toLowerCase();
            if (this.mongoEnv[optionNameLc]) {
                const ourEnv = this.mongoEnv[optionNameLc];
                optionAction.action(ourEnv.value, optionAction.name, ourEnv.key);
            }
        }
    }

//************************ Fixup Entries ***************************

    combinePathLists(path1, path2) {
        let newPath = "";
        for (const arg of arguments) {
            if (arg) {
                if (newPath) {
                    newPath = newPath + ",";
                }
            }
            newPath = newPath + arg;
        }
        return newPath;
    }

    fixupConnectionOptions(connectionOptions) {
        this.debugLog(`${this.msgPrefix} Fixup Values (e.g. Read Files)`);
        Object.getOwnPropertyNames(connectionOptions).forEach(name => {
            const value = connectionOptions[name];
            if (Array.isArray(value)) {
                connectionOptions[name] = connectionOptions[name].map(entry => {
                    return this.fixupValue(entry, name);
                })
            } else {
                connectionOptions[name] = this.fixupValue(value, name);
            }
        });
    }

    fixupValue(valueRaw, name) {
        this.debugLog(`${this.msgPrefix}  fixup ${name}: ${valueRaw}`);
        if (typeof valueRaw === 'string') {
            for (let prefix in this.filePrefixes) {
                if (valueRaw.startsWith(prefix)) {
                    let value = valueRaw.substr(prefix.length);      // strip off the prefix
                    return this.filePrefixes[prefix](value, valueRaw, name);
                }
            }
        }
        return valueRaw;
    }

    readEnv(value, entry, name) {
        this.debugLog(`${this.msgPrefix}       reading env:'${entry}'`);
        let result = "";
        if (typeof process.env[result] !== 'undefined') {
            result = process.env[result];
        } else {
            this.error(`${this.msgPrefix} Unable to read env:'${entry}' not defined`);
        }
        this.debugLog("  --> read: '${result}'");
        return result;
    }

    readFileOsPrivateSearch(value, valueRaw, name) {
        return this.readFileSearch(value, valueRaw, name, this.combinePathLists(this.osSearchPath, this.privateSearchPath));
    }

    readFileOsSearch(value, valueRaw, name) {
        return this.readFileSearch(value, valueRaw, name, this.osSearchPath);
    }

    readFilePrivateSearch(value, valueRaw, name) {
        return this.readFilePath(this.privateSearchPath + value, valueRaw, name);
    }

    readFilePath(fileName, valueRaw, name, options = {suppressErrors: false}) {
        let result = null;
        let readFile = false;
        try {
            if (!this.files[fileName]) {
                this.files[fileName] = fs.readFileSync(fileName);
                readFile = true;
            }
            result = this.files[fileName];
        } catch (err) {
            if (!options.suppressErrors) {
                let i;
                // Break up the error message so it's easier to read
                let errLines = [err.message];
                if (errLines[0].length > 80) {
                    errLines = errLines[0].split(",");
                    for (i = 0; i < errLines.length - 1; i++) {
                        errLines[i] = errLines[i] + ",";
                    }
                }
                let errorMsg = [`${this.msgPrefix} Unable to read ${name}='${valueRaw}'`,
                                `  trying filename: '${fileName}'`,
                                `  error: ${errLines[0] || "unknown" }`
                ];
                let indent = "       ";
                for (i = 1; i < errLines.length; i++) {
                    errorMsg.push(`${indent} ${errLines[i]}`);
                    indent += "  ";
                }

                this.error(errorMsg);
            }
            return null;
        }
        this.debugLog(`${this.msgPrefix}    ${readFile ? "reading" : "using cached copy"} '${valueRaw}' -> '${fileName}'` +
                      ` -- ${readFile ? "read" : "reloaded"} ${result ? result.length : 0} bytes.`);
        return result;     // Only need to read it once
    }

    readFilePrivateOsSearch(value, valueRaw, name) {
        return this.readFileSearch(value, valueRaw, name, this.combinePathLists(this.privateSearchPath, this.osSearchPath));
    }

    readFileSearch(value, valueRaw, name, pathList) {
        this.debugLog(`${this.msgPrefix}   readFile ${value}' along path ${pathList}`);
        const paths = pathList.split(',');
        for (const path of paths) {
            const thisFile = this.readFilePath(path.trim() + value, valueRaw, name, {suppressErrors: true});
            if (thisFile !== null) {
                return thisFile;        // Found our file and it's been debuglogged
            }
        }
        // We did'nt file the file -- so now try each file and generate errors for each try
        for (const path of paths) {
            const thisFile = this.readFilePath(path.trim() + value, valueRaw, name, {suppressErrors: false});
            if (thisFile !== null) {
                return thisFile;        // In case it magically appears...
            }
        }
        return null;
    }

    //*************************  Action Functions ******************************

    actionAddOptionName(value, name, key) {
        this.optionActions[value.toLowerCase()] = {action: this.actionFoundOption, name: value};
        this.debugLog(`${this.msgPrefix}  addOptionName = '${value}'`);
    }

    actionFoundDefault(value, name, key) {
        let defaultName = "";
        if (typeof this.defaultConnectionOptionNamesLc[value.toLowerCase()] !== undefined) {
            defaultName = this.defaultConnectionOptionNamesLc[value.toLowerCase()];
        }
        if (!defaultName) {
            this.error(
                `${this.msgPrefix} Unrecognized default option:'${value}'  Valid values: "${Object.keys(this.defaultConnectionOptionNamesLc).join('", "')}"`
            );
            return;
        }

        this.debugLog(`${this.msgPrefix}   setting connectionOptions to default values for '${defaultName}'`);

        this.connectionOptions = this.defaultConnectionOptions[defaultName];
    }

    actionFoundOption(value, name, key) {
        this.debugLog(`${this.msgPrefix}   found Option ${name}='${value}'`);
        this.connectionOptions[name] = value;
    }

    actionIgnore(value, name, key) {
        this.debugLog(`${this.msgPrefix}   ignore ${name}='${value}'`);
    }

    actionSetDebugLog(value = "", name, key) {
        if (value.toLowerCase() === "true") {
            this.debugLog = console.log.bind(this);
        } else {
            this.debugLog = this.noop.bind(this);
        }
    }

    actionSetOsSearchPath(value, name, key) {
        const path = value.replace(/^[\s\uFEFF\xA0"']+|[\s\uFEFF\xA0"']+$/g, '');       // Strip any quotation marks
        this.debugLog(`${this.msgPrefix}   set OS File Search Path '${value}'`);
        this.osSearchPath = value;
    }

    actionSetOptions(value, name, key) {
        this.debugLog(`${this.msgPrefix} set connectionOptions from env:${key} '${value}'`);
        // connectionOptions are in the form option=value,connectionOptions=value, ...
        const option = value.split(',');
        option.forEach(option => {
            const optionParts = option.split('=');
            if (optionParts.length !== 2) {
                this.error(
                    `${this.msgPrefix} invalid option '${option}' found in ${key}: '${value}'`
                );
            } else {
                let thisOption = optionParts[0].trim();
                let thisOptionLc = thisOption.toLowerCase();
                let thisValue = optionParts[1].trim();
                this._processOption(thisOptionLc, thisValue, thisOption, key);
            }
        })
    }

    _processOption(optionLc, value, name, key) {
        this.debugLog(`${this.msgPrefix}  process Option '${name}'='${value}'`);
        if (this.ourOptionActions[optionLc]) {
            this.ourOptionActions[optionLc].action(value, this.ourOptionActions[optionLc].name, key);
            return;
        }
        if (this.optionActions[optionLc]) {
            this.optionActions[optionLc].action(value, this.optionActions[optionLc].name, key);
            return;
        }
        this.error(`${this.msgPrefix} invalid option name '${name}'(= '${value}') found in env:${key}!`);
    }

    actionSetPrivateSearchPath(value, name, key) {
        const path = value.replace(/^[\s\uFEFF\xA0"']+|[\s\uFEFF\xA0"']+$/g, '');       // Strip any quotation marks
        this.debugLog(`${this.msgPrefix}   set Private File SearchPath '${value}'`);
        this.privateSearchPath = value;
    }

    actionWarningOption(value, name, key) {
        const warningOption = this.warningOptions[name.toLowerCase()];
        this.warning(
            [`${this.msgPrefix} Warning for option ${name} found in env:${key}!`,
             `${this.msgPaddng}   ${warningOption.warningText}`
            ]
        );
        warningOption.action(value, name, key);
    }

    actionListInternal(value, name, key) {
        console.log(`${this.msgPrefix} Internal Options:`);
        for (const option in this.internalOptions) {
            console.log(`  ${option} `)
        }
        console.log('-'.repeat(40));
    }

    actionListOptions(value, name, key) {
        console.log(`${this.msgPrefix} Valid Connection Options:`);
        for (const option of this.legalOptionNames) {
            console.log(`  ${option} `)
        }
        console.log('-'.repeat(40));
    }

    //*********************** Message Functions **********************

    boxMsg(text, char, minWidth = 40, maxWidth = 120) {
        if (!Array.isArray(text)) {
            text = [text];
        }
        let maxLen = minWidth;        // Our minimum box size
        text.forEach(line => {
            if (line.length > maxLen) {
                maxLen = line.length;
            }
        });
        maxLen += 6;        // Add in our endings
        let boxSize = maxLen > maxWidth ? maxWidth : maxLen;

        const myText = char + '  ' + text + '  ' + char;
        console.log(char.repeat(boxSize));
        console.log(char + ' '.repeat(boxSize - 2) + char);
        text.forEach(line => {
            let thisLine = char + '  ' + line;
            if (thisLine.length < (boxSize - 3)) {
                thisLine += ' '.repeat((boxSize - 3) - thisLine.length)
            }
            thisLine += '  ' + char;
            console.log(thisLine);
        });
        console.log(char + ' '.repeat(boxSize - 2) + char);
        console.log(char.repeat(boxSize))
    }

    error(text) {
        this.boxMsg(text, '?', 40, 120);
    }

    warning(text) {
        this.boxMsg(text, '%', 40, 120);
    }

    //*********************** Our Public Methods **********************

    loadConnectionOptions() {
        this._loadEnvValues();            // find matching Environmental variables

        this._processInternalActions();        // Go process our actions

        this._processMongoEntries();      // Go process any other entries

        this.fixupConnectionOptions(this.connectionOptions);         // Go read in files
    }

    haveConnectionsOptions() {
        return !!(Object.keys(this.connectionOptions));
    }

    setConnectionOptions() {
        if (this.haveConnectionsOptions()) {      // IF there are connection options -- set them
            Mongo.setConnectionOptions(this.connectionOptions);
        }
    }

    loadAndSetConnectionOptions() {
        const self = this;
        self.loadConnectionOptions();
        self.setConnectionOptions();
    }
}

Mongo.myConnectionOptions = new connectionOptions();
Mongo.myConnectionOptions.loadAndSetConnectionOptions();
