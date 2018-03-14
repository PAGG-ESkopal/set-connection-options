import {Mongo} from 'meteor/mongo';

import fs from 'fs';
import os from 'os';

/** @namespace process.env.SystemRoot */

class EnvConnectionOptions {
    constructor(envPrefix = ['MONGO_SCO_', 'MONGO_CONNECTION_'], envTest) {

        this.msgPrefix = 'set-connection-options --';

        this.envPrefix = envPrefix;
        this.env = envTest || process.env;

        this.connectionOptions = {};

        this.maxBoxWidth = 150;

        this.internalOptions = {
            "debugLog": this.actionSetDebugLog.bind(this),      // Set our debugging flag first
            "options":  this.actionSetOptions.bind(this),        // then read our options
            "default":  this.actionFoundDefault.bind(this),      // then set the default

            "addOptionName":     this.actionAddOptionName.bind(this),
            "filePath":          this.actionSetOsSearchPath.bind(this),
            "osSearchPath":      this.actionSetOsSearchPath.bind(this),
            "privatePath":       this.actionSetPrivateSearchPath.bind(this),
            "privateSearchPath": this.actionSetPrivateSearchPath.bind(this),
            "searchPath":        this.actionSetOsSearchPath.bind(this),

            "listInternal":     this.actionListInternal.bind(this),
            "listOptions":      this.actionListOptions.bind(this),
            "listValidOptions": this.actionListOptions.bind(this),
        };

        this.validOptionsInfo = "validOptionsNames taken from mongo_client.js v2.2.34 (Mar 2, 2018)";
        this.validOptions = {
            'acceptableLatencyMS':          {default: '15', desc: "Cutoff latency point in MS for Mongos proxies selection."},
            'appname':                      {
                desc: "The name of the application that created this MongoClient instance.\n" +
                      "MongoDB 3.4 and newer will print this value in the server log upon establishing\n" +
                      "each connection. It is also recorded in the slow query log and profile collections."
            },
            'auth':                         {desc: "auth.password - The password for auth, auth.user - The username for auth"},
            'authSource':                   {desc: "Define the database to authenticate against"},
            'autoReconnect':                {default: 'true', desc: "Enable autoReconnect for single server instances"},
            'bufferMaxEntries':             {
                default: '-1',
                desc:    "Sets a cap on how many operations the driver will buffer up before giving up\n" +
                         "on getting a working connection, default is -1 which is unlimited."
            },
            'checkServerIdentity':          {
                default: 'true',
                desc:    "Ensure we check server identify during SSL, set to false to disable checking.\n" +
                         "Only works for Node 0.12.x or higher. You can pass in a boolean or your own\n" +
                         "checkServerIdentity override function."
            },
            'ciphers':                      {},
            'connectTimeoutMS':             {default: '30000', desc: "TCP Connection timeout setting"},
            'connectWithNoPrimary':         {desc: "Sets if the driver should connect even if no primary is available"},
            'domainsEnabled':               {
                desc: "Enable the wrapping of the callback in the current domain,\n" +
                      "disabled by default to avoid perf hit."
            },
            'ecdhCurve':                    {},
            'family':                       {default: '4', desc: "Version of IP stack. Defaults to 4."},
            'forceServerObjectId':          {desc: "Force server to assign _id values instead of driver."},
            'ha':                           {default: 'true', desc: "Control if high availability monitoring runs for Replicaset or Mongos proxies."},
            'haInterval':                   {default: '10000', desc: "The High availability period for replicaset inquiry"},
            'ignoreUndefined':              {desc: "Specify if the BSON serializer should ignore undefined fields."},
            'j':                            {desc: "Specify a journal write concern."},
            'keepAlive':                    {default: '30000', desc: "The number of milliseconds to wait before initiating keepAlive on the TCP socket."},
            'keepAliveInitialDelay':        {},
            'logger':                       {desc: "Custom logger object"},
            'loggerLevel':                  {desc: "The logging level (error/warn/info/debug)"},
            'maxStalenessSeconds':          {desc: "The max staleness to secondary reads (values under 10 seconds cannot be guaranteed);"},
            'noDelay':                      {default: 'true', desc: "TCP Connection no delay"},
            'pkFactory':                    {desc: "A primary key factory object for generation of custom _id keys."},
            'poolSize':                     {default: '5', desc: "poolSize The maximum size of the individual server pool."},
            'promiseLibrary':               {desc: "A Promise library class the application wishes to use such as Bluebird, must be ES6 compatible"},
            'promoteBuffers':               {desc: "Promotes Binary BSON values to native Node Buffers."},
            'promoteLongs':                 {default: 'true', desc: "Promotes Long values to number if they fit inside the 53 bits resolution."},
            'promoteValues':                {
                default: 'true',
                desc:    "Promotes BSON values to native types where possible,\n" +
                         "set to false to only receive wrapper types."
            },
            'raw':                          {desc: "Return document results as raw BSON buffers."},
            'readConcern':                  {
                desc: "Specify a read concern for the collection. readConcern.level(default:local)\n" +
                      "Specify a read concern level for the collection operations, one of\n" +
                      "[local|majority]. (only MongoDB 3.2 or higher supported)"
            },
            'readPreference':               {
                desc: "The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED,\n" +
                      "ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST)."
            },
            'reconnectInterval':            {default: '1000', desc: "Server will wait # milliseconds between retries"},
            'reconnectTries':               {default: '30', desc: "Server attempt to reconnect #times"},
            'replicaSet':                   {desc: "The Replicaset set name"},
            'secondaryAcceptableLatencyMS': {default: '15', desc: "Cutoff latency point in MS for Replicaset member selection"},
            'serializeFunctions':           {desc: "Serialize functions on any object."},
            'socketTimeoutMS':              {default: '360000', desc: "TCP Socket timeout setting"},
            'ssl':                          {
                action:        this.actionWarningOption.bind(this),
                desc:          "Enable SSL connection.",
                warningText:   "Setting SSL here prevents using SSL and NON-SSL connections at the same time (ssl ignored).",
                warningAction: this.actionIgnore.bind(this)
            },
            'sslCA':                        {isBufferObj: true, translatedName: 'ca', desc: "Array of valid certificates for Certificate Authority either as Buffers or Strings."},
            'sslCert':                      {isBufferObj: true, translatedName: 'cert', desc: "String or buffer containing the client certificate."},
            'sslCRL':                       {isBufferObj: true, translatedName: 'crl', desc: "Array of revocation certificates as Buffers or Strings."},
            'sslKey':                       {isMultiLine: true, translatedName: 'key', desc: "Optional private keys in PEM format."},
            'sslPass':                      {translatedName: 'passphrase', desc: "String or buffer containing the client certificate password."},
            'sslValidate':                  {translatedName: 'rejectUnauthorized', desc: "Validate server certificate against certificate authority."},
            'validateOptions':              {desc: "Validate MongoClient passed in options for correctness."},
            'w':                            {desc: "The write concern."},
            'wtimeout':                     {desc: "The write concern timeout."},
        };

        this.legalOptionAction = this.actionFoundOption.bind(this);

        // Define a set of default options support SSL and X509 validation

        this.defaultConnectionOptionNamesLc = {
            'default':    'sslint',
            'none':       'none',
            'ssl':        'sslint',
            'sslext':     'sslext',
            'sslint':     'sslint',
            'sslx509':    'sslint',
            'sslx509ext': 'sslext',
            'sslx509int': 'ssl',
        };

        this.defaultConnectionOptions = {
            /**
             * Default configuration -- read certificates from external sources first
             */
            'sslext': {
                sslCA:       ["@@caCert.pem"],          // Array of valid certificates for Certificate Authority either as Buffers or Strings.
                sslCert:     "@@clientCert.pem",        // String or buffer containing the client certificate.
                sslCRL:      [],                        // Array of revocation certificates as Buffers or Strings.
                sslKey:      "@@clientCert.pem",        // Optional private keys in PEM format.
                sslPass:     "@@clientCert.passphrase", // String or buffer containing the client certificate password.
                sslValidate: true,                      // Validate server certificate against certificate authority.
            },
            /**
             * Default configuration -- read certificates from private first
             */
            'sslint': {
                sslCA:       ["@caCert.pem"],           // Array of valid certificates for Certificate Authority either as Buffers or Strings.
                sslCert:     "@clientCert.pem",         // String or buffer containing the client certificate.
                sslCRL:      [],                        // Array of revocation certificates as Buffers or Strings.
                sslKey:      "@clientCert.pem",         // Optional private keys in PEM format.
                sslPass:     "@clientCert.passphrase",  // String or buffer containing the client certificate password.
                sslValidate: true,                      // Validate server certificate against certificate authority.
            },
            'none':   {},
        };

        this.filePrefixes = {
            '@@':        this.readFileOsPrivateSearch.bind(this),  // Read a file from disk then our private folder !!! '@@' must be before '@' !!!
            '@':         this.readFilePrivateOsSearch.bind(this),   // Read a file from our private folder then disk
            'env:':      this.readEnv.bind(this),
            'file:':     this.readFileOsSearch.bind(this),
            'filepath:': this.readFilePath.bind(this),
            'filePath:': this.readFilePath.bind(this),
            'internal:': this.readFilePrivateSearch.bind(this),
            'path:':     this.readFilePath.bind(this),
            'private:':  this.readFilePrivateSearch.bind(this),
        };

        this.privateSearchPath = 'assets/app/';

        this.osSearchPath = "/etc/ssl/meteor,/etc/";

        const isWindows = os.platform() === 'win32';
        if (isWindows) {
            const systemRoot = this.env.SystemRoot || process.env.SystemRoot;
            const systemEtc = `${systemRoot}\\system32\\drivers\\etc`;
            this.osSearchPath = `${systemEtc}\\ssl\\meteor\\,${systemEtc}\\`;
        }

        this.fileCache = {};

        this.mongoEnv = {};

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
            this.ourOptionActions[optionName.toLowerCase()] = {
                action: this.internalOptions[optionName], name: optionName
            };
        }

        for (const [optionName, legalEntry] of Object.entries(this.validOptions)) {
            const action = legalEntry.action ? legalEntry.action : this.legalOptionAction;
            this.optionActions[optionName.toLowerCase()] = {
                action: action, name: optionName
            };
        }
    }

    /**
     * Read env variables to retrieve our DEBUGLOG setting
     * @private
     */
    _initDebugLog() {
        const envPrefix = [];
        this.envPrefix.forEach(prefix => {
            if (this.env[prefix + "DEBUGLOG"]) {
                this.actionSetDebugLog(this.env[prefix + "DEBUGLOG"], "debugLog", prefix + "DEBUGLOG");
            }
        });
    }

    /**
     * Read all the Mongo_ env variables into mongoEnv removing the MONGO_xxx prefix with lowercase names
     */
    _loadEnvValues() {
        this.debugLog(`${this.msgPrefix} Load Environmental Variables`);
        const envPrefix = [];
        this.envPrefix.forEach(prefix => {
            envPrefix.push(prefix.toLowerCase())
        });

        for (let entry in this.env) {
            const entrylc = entry.toLowerCase();
            envPrefix.forEach(prefix => {
                if (entrylc.startsWith(prefix)) {
                    this.mongoEnv[entrylc.substr(prefix.length)] = {
                        key: entry, name: entry.substr(prefix.length), value: this.env[entry]
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
        this.debugLog(`${this.msgPrefix} Process Environmental Variables beginning with ["${this.envPrefix.join('" or "')}"]`);
        for (const [key, mongoEntry] of Object.entries(this.mongoEnv)) {
            const optionName = mongoEntry.name;
            const optionNameLc = optionName.toLowerCase();
            if (!this.ourOptionActions[optionNameLc]) {
                // It's not one of our actions
                if (this.optionActions[optionNameLc]) {
                    this.optionActions[optionNameLc].action(mongoEntry.value, this.optionActions[optionNameLc].name, mongoEntry.key)
                } else {
                    this.error([`${this.msgPrefix} invalid option '${optionName}' found in ${key}: '${mongoEntry.value}'`, `${this.msgPaddng}   Value Ignored'`]);
                }
            }
        }
    }

    /**
     * Process each MONGO_ env variable that is one of OUR internal options
     */
    _processInternalActions() {
        this.debugLog(`${this.msgPrefix} Process Environmental Variables beginning with ["${this.envPrefix.join('" or "')}"] (Internal Only)`);
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
        if (typeof this.env[result] !== 'undefined') {
            result = this.env[result];
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
            if (!this.fileCache[fileName]) {
                if (this.validOptions[name].isBufferObj) {
                    this.fileCache[fileName] = fs.readFileSync(fileName);
                } else {
                    this.fileCache[fileName] = fs.readFileSync(fileName, 'ascii');
                    if (!this.validOptions[name].isMultiLine) {
                        this.fileCache[fileName] = this.fileCache[fileName].replace(/\n/g, "");
                    }
                }
                readFile = true;
            }
            result = this.fileCache[fileName];
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
                let errorMsg = [`${this.msgPrefix} Unable to read ${name}='${valueRaw}'`, `  trying filename: '${fileName}'`, `  error: ${errLines[0] || "unknown" }`];
                let indent = "       ";
                for (i = 1; i < errLines.length; i++) {
                    errorMsg.push(`${indent} ${errLines[i]}`);
                    indent += "  ";
                }

                this.error(errorMsg);
            }
            return null;
        }
        this.debugLog(`${this.msgPrefix}    ${readFile ? "reading" : "using cached copy"} '${valueRaw}' -> '${fileName}'` + ` -- ${readFile ? "read" : "reloaded"} ${result ? result.length : 0} bytes.`);
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
        this.optionActions[value.toLowerCase()] = {
            action: this.actionFoundOption, name: value
        };
        this.debugLog(`${this.msgPrefix}  addOptionName = '${value}'`);
    }

    actionFoundDefault(value, name, key) {
        let defaultName = "";
        if (typeof this.defaultConnectionOptionNamesLc[value.toLowerCase()] !== undefined) {
            defaultName = this.defaultConnectionOptionNamesLc[value.toLowerCase()];
        }
        if (!defaultName) {
            this.error(`${this.msgPrefix} Unrecognized default option:'${value}'  Valid values: "${Object.keys(this.defaultConnectionOptionNamesLc).join('", "')}"`);
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
                this.error(`${this.msgPrefix} invalid option '${option}' found in ${key}: '${value}'`);
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
        const warningText = this.validOptions[name.toLowerCase()].warningText;
        this.warning([`${this.msgPrefix} Warning for option ${name} found in env:${key}`, `   ${warningText}`]);
        this.validOptions[name.toLowerCase()].warningAction(value, name, key);
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
        console.log(`  --(${this.validOptionsInfo})--`);
        let nameWidth = 10;
        for (const [optionName, legalEntry] of Object.entries(this.validOptions)) {
            if (optionName.length > nameWidth) {
                nameWidth = optionName.length;
            }
        }
        for (const [optionName, legalEntry] of Object.entries(this.validOptions)) {
            let output = ' '.repeat(nameWidth - optionName.length) + optionName + ' ';
            let sep = "";
            for (const [attrName, attrValue] of Object.entries(legalEntry)) {
                if (typeof attrValue === 'string') {
                    output += sep + attrName + '=';
                    sep = ", ";
                    const lines = attrValue.split('\n');
                    output += lines[0];
                    for (let i = 1; i < lines.length; i++) {
                        output += '\n' + ' '.repeat(nameWidth + 7) + lines[i];
                    }
                }
            }
            console.log(output);
        }
        console.log('-'.repeat(40));
    }

    //*********************** Message Functions **********************

    boxMsg(text, char, minWidth = 40, maxWidth = this.maxBoxWidth) {
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

Mongo.envConnectionOptions = new EnvConnectionOptions();

Mongo.envConnectionOptions.loadAndSetConnectionOptions();
