// Write your package code here!

import {Mongo} from 'meteor/mongo';

const fs = require('fs');

global.connectionOptions = {
    // These are all of the legal options extracted from Meteor version 1.6.1
    legalOptionNames: [
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
    ],

    // These options end up being used by NODEjs TLS facility
    //  below are the translations from Meteor to TLS
    translations: {
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
    },

    doNotSetOptions: ['ssl'],

    ourOptions: {
        "doDebugLog": actionSetDoDebugLog,      // Set our debugging flag first

        "options": actionSetOptions,            // then read our options

        "default": actionFoundDefault,          // then set the default

        "allowAny": actionAllowAny,
        "filePath": actionSetFilePath,
        "file_path": actionSetFilePath,
    },

    // Define a set of default options support SSL and X509 validation

    defaultOptionNames: {
        'default': 'ssl',
        'none': 'none',
        'ssl': 'ssl',
        'sslX509': 'ssl',
    },

    ssl_defaultOptions: {
        sslCA: ["file:caCert.pem"],     // Array of valid certificates for Certificate Authority either as Buffers or Strings.
        sslCert: "file:clientCert.pem", // String or buffer containing the client certificate.
        sslCRL: [],                     // Array of revocation certificates as Buffers or Strings.
        sslKey: "file:clientCert.pem",  // Optional private keys in PEM format.
        sslPass: null,                  // String or buffer containing the client certificate password.
        sslValidate: true,              // Validate server certificate against certificate authority.
    },

    none_defaultOptions: {},

    actionPrefixes: {
        '@': readPrivateFile,
        'env:': readEnv,
        'file:': readFile,
        'filePath:': readFilePath,
        'private': readPrivateFile,
    },

    envPrefix: ['MONGO_SCO_', 'MONGO_CONNECTION_'],

    privateFilePath: 'assets/app/',

    filePath: 'assets/app/',

    files: {},

    mongoEnv: {},

    options: {},

    msgPrefix: 'set-connection-options --',
    msgPaddng: '                         ',

    doDebugLog: true,

    debugLog: null,

    noop: function () {},
};

const self = global.connectionOptions;

actionSetDoDebugLog(self.doDebugLog);

const optionActions = {};
const ourOptionActions = {};

setupActions();             // Setup our action tables

loadEnvValues();            // find matching Environmental variables

processOurActions();        // Go process our actions

processMongoEntries();      // Go process any other entries

if (Object.keys(self.options)) {      // IF there is any work to do -- go do it...

    fixupOptions(self.options);         // Go read in files

    Mongo.setConnectionOptions(self.options);   // now Set our options
}

// Copy all the Mongo_ env variables into mongoenv removing MONGO_xxx prefix
function loadEnvValues() {
    const env = process.env;
    const envPrefix = [];
    self.envPrefix.forEach(prefix => {
        envPrefix.push(prefix.toLowerCase())
    });

    for (let entry in env) {
        const entrylc = entry.toLowerCase();
        envPrefix.forEach(prefix => {
            if (entrylc.startsWith(prefix)) {
                self.mongoEnv[entrylc.substr(prefix.length)] = {
                    key: entry,
                    name: entry.substr(prefix.length),
                    value: env[entry]
                };
            }
        })
    }
}

// Process any entries that start with MONGO_SCO_ or MONGO_CONNECTION_
function processMongoEntries() {
    for (const [key, mongoEntry] of Object.entries(self.mongoEnv)) {
        const optionName = mongoEntry.name;
        const optionNameLc = optionName.toLowerCase();
        if (!ourOptionActions[optionNameLc]) {
            // It's not one of our actions
            if (optionActions[optionNameLc]) {
                optionActions[optionNameLc].action(mongoEntry.value, optionActions[optionNameLc].name, mongoEntry.key)
            } else {
                error([
                          `${self.msgPrefix} invalid option '${optionName}' found in ${key}: '${mongoEntry.value}'`,
                          `${self.msgPaddng}   Value Ignored'`
                      ]);
            }
        }
    }
}

// Process any env entries that match ourActions
function processOurActions() {
    for (const [optionName, optionEntry] of Object.entries(ourOptionActions)) {
        const optionNameLc = optionName.toLowerCase();
        if (self.mongoEnv[optionNameLc]) {
            const ourEnv = self.mongoEnv[optionNameLc];
            optionEntry.action(ourEnv.value, optionEntry.name, ourEnv.key);
        }
    }
}

function setupActions() {

    for (let optionName in self.ourOptions) {
        ourOptionActions[optionName.toLowerCase()] = {action: self.ourOptions[optionName], name: optionName};
    }
    self.legalOptionNames.forEach(optionName => {
        optionActions[optionName.toLowerCase()] = {action: actionFoundOption, name: optionName};
    });

    self.doNotSetOptions.forEach(optionName => {
        optionActions[optionName.toLowerCase()] = {action: actionDoNotSet, name: optionName};
    })
}

//************************ Fixup Entries ***************************

function fixupOptions(options) {
    Object.getOwnPropertyNames(options).forEach(name => {
        const value = options[name];
        if (Array.isArray(value)) {
            options[name] = options[name].map(entry => {
                return fixupValue(entry, name);
            })
        } else {
            options[name] = fixupValue(value, name);
        }
    });
}

function fixupValue(valueRaw, name) {
    self.debugLog("%s    fixup %s: %s", self.msgPrefix, name, valueRaw);
    if (typeof valueRaw === 'string') {
        for (let prefix in self.actionPrefixes) {
            if (valueRaw.startsWith(prefix)) {
                let value = valueRaw.substr(prefix.length);      // strip off the prefix
                return self.actionPrefixes[prefix](value, valueRaw, name);
            }
        }
    }
    return valueRaw;
}

function readFile(value, valueRaw, name) {
    return readFilePath(self.filePath + value, valueRaw, name);
}

function readPrivateFile(value, valueRaw, name) {
    return readFilePath(self.privateFilePath + value, valueRaw, name);
}

function readFilePath(fileName, valueRaw, name) {
    let result = null;
    let readFile = false;
    try {
        if (!self.files[fileName]) {
            self.files[fileName] = fs.readFileSync(fileName);
            readFile = true;
        }
        result = self.files[fileName];
    } catch (err) {
        error(
            [`${self.msgPrefix} Unable to read ${name}='${valueRaw}' -> '${fileName}'`,
             `${self.msgPaddng}   error: ${err.message}`
            ]
        );
    }
    self.debugLog("%s     %s '%s' -> '%s' -- %s %d bytes.",
                  self.msgPrefix,
                  readFile ? "reading" : "using cached copy",
                  valueRaw,
                  fileName,
                  readFile ? "read" : "reloaded",
                  result ? result.length : 0
    );
    return result;     // Only need to read it once
}

function readEnv(value, entry, name) {
    self.debugLog("%s       reading '%s'", self.msgPrefix, entry);
    let result = "";
    if (typeof process.env[result] !== 'undefined') {
        result = process.env[result];
    } else {
        error(
            `${self.msgPrefix} Unable to read env:'${entry}' not defined`
        );
    }
    self.debugLog("  --> read: '%s'", result);
}

//*************************  Action Functions ******************************

function actionAllowAny(value, name, key) {
    self.allowAny = !!value;
    self.debugLog("%s   allowAny = '%s'", self.msgPrefix, self.allowAny);
}

function actionDoNotSet(value, name, key) {
    warning(
        [`${self.msgPrefix} Error in env:${key}!`,
         `${self.msgPaddng}   Do not set '${name}=${value}' here -- set it in the URI! -- Ignoring setting`,
        ]
    );
}

function actionFoundDefault(value, name, key) {
    let defaultName = "";
    if (typeof self.defaultOptionNames[value] !== undefined) {
        defaultName = self.defaultOptionNames[value];
    } else if (typeof self.defaultOptionNames[value.toLowerCase()] !== undefined) {
        defaultName = self.defaultOptionNames[value.toLowerCase()];
    }
    if (!defaultName) {
        error(`${self.msgPrefix} Unrecognized default option:'${value}'  Valid values: "${Object.keys(self.defaultOptionNames).join('", "')}"`);
        return;
    }

    self.debugLog("%s   setting options to default values for '%s'", self.msgPrefix, defaultName);

    self.options = self[defaultName + '_defaultOptions'];
}

function actionFoundOption(value, name, key) {
    self.debugLog("%s   found Option %s='%s'", self.msgPrefix, name, value);
    self.options[name] = value;
}

function actionSetDoDebugLog(value, name, key) {
    self.doDebugLog = !!value;
    if (self.doDebugLog) {
        self.debugLog = console.log.bind(self);
    } else {
        self.debugLog = self.noop.bind(self);
    }
}

function actionSetFilePath(value, name, key) {
    const path = value.replace(/^[\s\uFEFF\xA0\"\']+|[\s\uFEFF\xA0\"\']+$/g, '');       // Strip any quotation marks
    self.debugLog("%s   set filePath '%s'", self.msgPrefix, value);
    self.filePath = value;
}

function actionSetOptions(value, name, key) {
    self.debugLog("%s set Options from env:%s '%s'", self.msgPrefix, key, value);
    // Options are in the form option=value,options=value, ...
    const options = value.split(',');
    options.forEach(option => {
        const optionParts = option.split('=');
        if (optionParts.length !== 2) {
            error(
                `${self.msgPrefix} invalid option '${option}' found in ${key}: '${value}'`
            );
        } else {
            let thisOption = optionParts[0].trim();
            let thisOptionLc = thisOption.toLowerCase();
            let thisValue = optionParts[1].trim();
            processOption(thisOptionLc, thisValue, thisOption, key);
        }
    })
}

function processOption(optionLc, value, name, key) {
    self.debugLog("%s  process Option '%s'='%s'", self.msgPrefix, name, value);
    if (ourOptionActions[optionLc]) {
        ourOptionActions[optionLc].action(value, ourOptionActions[optionLc].name, key);
        return;
    }
    if (optionActions[optionLc]) {
        optionActions[optionLc].action(value, optionActions[optionLc].name, key);
        return;
    }
    if (self.allowAny) {
        actionFoundDefault(value, name, key);
        return;
    }
    error(
        `${self.msgPrefix} invalid option name '${name}'(='${value}') found in env:${key}!`
    );
}

//*********************** Message Functions **********************

function boxMsg(text, char, minWidth = 40, maxWidth = 120) {
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
    boxSize = maxLen > maxWidth ? maxWidth : maxLen;

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

function error(text) {
    boxMsg(text, '?', 40, 120);
}

function warning(text) {
    boxMsg(text, '%', 40, 120);
}
