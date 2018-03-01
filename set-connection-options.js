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
        "options": setOptions,      // Always look for this one first...

        "default": foundDefault,
        "allowAny": allowAny,
        "doDebugLog": setDoDebugLog,
        "filePath": setFilePath,
        "file_path": setFilePath,
    },

    // Define a set of default options support SSL and X509 validation

    defaultOptionNames: {
        'default': 'ssl',
        'none': 'none',
        'ssl': 'ssl',
        'sslX509': 'ssl',
    },

    ssl_defaultOptions: {
        sslCA: ["@caCert.pem"],     // Array of valid certificates for Certificate Authority either as Buffers or Strings.
        sslCert: "@clientCert.pem", // String or buffer containing the client certificate.
        sslCRL: [],                 // Array of revocation certificates as Buffers or Strings.
        sslKey: "@clientCert.pem",  // Optional private keys in PEM format.
        sslPass: null,              // String or buffer containing the client certificate password.
        sslValidate: true,          // Validate server certificate against certificate authority.
    },

    none_defaultOptions: {},

    actionPrefixes: {
        '@': readFile,
        'file:': readFile,
        'filePath:': readFilePath,
        'env:': readEnv
    },

    envPrefix: ['MONGO_SCO_', 'MONGO_CONNECTION_'],

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

setDoDebugLog(self.doDebugLog);

const optionActions = {};           // create actions for each Option Name
const ourOptionActions = {};
const optionNames = {};       // Translate back from lower case to correct caseness

setupActions();         // Setup our action tables

loadEnvValues();

processOurActions();        // Go process our actions
processMongoEntries();      // Go process any other entries

if (Object.keys(self.options)) {      // IF there is any work to do -- go do it...

    fixupOptions(self.options);

    Mongo.setConnectionOptions(self.options);
}

// Process any entries that start with MONGO_SCO_ or MONGO_CONNECTION_
function processMongoEntries() {

}

// Process any env entries that match ourActions
function processOurActions() {
    for (const [optionName, optionAction] of Object.entries(ourOptionActions)) {
        const optionNameLc = optionName.toLowerCase();
        if (self.mongoEnv[optionNameLc]) {
            const ourEnv = self.mongoEnv[optionNameLc];
            optionAction(ourEnv.value, ourEnv.key);
        }
    }
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

function setupActions() {

    for (let optionName in self.ourOptions) {
        ourOptionActions[optionName.toLowerCase()] = self.ourOptions[optionName];
        optionNames[optionName.toLowerCase()] = optionName;
    }
    self.legalOptionNames.forEach(optionName => {
        optionActions[optionName.toLowerCase()] = foundOption;
        optionNames[optionName.toLowerCase()] = optionName;
    });

    self.doNotSetOptions.forEach(optionName => {
        optionActions[optionName] = doNotSet;
    })
}

/**
 * Read through each of the options replacing any values that start with @
 *   with the contents of the matching file located in the private direcory.
 * @param options
 */

function fixupOptions(options) {
    Object.getOwnPropertyNames(options).forEach(name => {
        const value = options[name];
        if (Array.isArray(value)) {
            options[name] = options[name].map(entry => {
                return fixupEntry(entry, name);
            })
        } else {
            options[name] = fixupEntry(value, name);
        }
    });
}

/**
 * Read each entry in the options and replace any that start with @
 *  by reading the file with the same name located in the private directory.
 * @param entry
 * @param name
 * @returns {*}
 */
function fixupEntry(entry, name) {
    self.debugLog("%s fixup %s: %s", self.msgPrefix, name, entry);
    if (typeof entry === 'string') {
        for (let prefix in self.actionPrefixes) {
            if (entry.startsWith(prefix)) {
                let value = entry.substr(prefix.length);      // strip off the prefix
                return self.actionPrefixes[prefix](value, entry, name);
            }
        }
    }
    return entry;
}

function foundDefault(value, key) {
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

    self.debugLog("%s setting options to default values for '%s'", self.msgPrefix, defaultName);

    self.options = self[defaultName + '_defaultOptions'];
}

function readFile(value, entry) {
    return readFilePath(self.filePath + value, value);
}

function readFilePath(fileName, entry) {
    let result = null;
    let readFile = false;
    try {
        if (!self.files[fileName]) {
            self.files[fileName] = fs.readFileSync(fileName);
            readFile = true;
        }
        result = self.files[fileName];
    } catch (error) {
        error(
            `${self.msgPrefix} Unable to read env:'${entry}' error: ${error.message}`
        );
    }
    self.debugLog("%s %s '%s' -> '%s' -- %s %d bytes.",
                  self.msgPrefix,
                  readFile ? "reading" : "using cached copy",
                  entry,
                  fileName,
                  readFile ? "read" : "reloaded",
                  result ? result.length : 0
    );
    return result;     // Only need to read it once
}

function readEnv(value, entry) {
    self.debugLog("%s reading '%s'", self.msgPrefix, entry);
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

//*************************  Actions ******************************

function allowAny(value, key) {
    self.allowAny = !!value;
    self.debugLog("%s allowAny = '%s'", self.msgPrefix, self.allowAny);
}

function setDoDebugLog(value, key) {
    self.doDebugLog = !!value;
    if (self.doDebugLog) {
        self.debugLog = console.log.bind(self);
    } else {
        self.debugLog = self.noop.bind(self);
    }
}

function processOption(optionLc, value, name, key) {
    self.debugLog("%s process Option '%s'='%s'", self.msgPrefix, name, value);
    if (ourOptionActions[optionLc]) {
        ourOptionActions[optionLc](value, name, key);
        return;
    }
    if (optionActions[optionLc]) {
        optionActions[optionLc](value, name, key);
        return;
    }
    if (self.allowAny) {
        foundDefault(value, name, key);
        return;
    }
    error(
        `${self.msgPrefix} invalid option '${name}' found in env:${key}!`
    );
}

function setOptions(value, key) {
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

function setFilePath(value, key) {
    const path = value.replace(/^[\s\uFEFF\xA0\"\']+|[\s\uFEFF\xA0\"\']+$/g, '');       // Strip any quotation marks
    self.debugLog("%s set filePath '%s'", self.msgPrefix, value);
    self.filePath = value;
}

function foundOption(value, name, key) {
    self.debugLog("%s found Option %s='%s'", self.msgPrefix, name, value);
    self.options[name] = value;
}

function doNotSet(value, name, key) {
    warning(
        [`${self.msgPrefix} Error in env:${key}!`,
         `${self.msgPaddng}   Do not set '${name}=${value}' here -- set it in the URI! -- Ignoring setting`,
        ]
    );
}

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
