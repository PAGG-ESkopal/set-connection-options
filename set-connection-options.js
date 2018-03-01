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

    otherOptions: {
        "allowAny": allowAny,
        "default": foundDefault,
        "doDebugLog" : setDoDebugLog,
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

    envName: 'MONGO_CONNECTION_OPTIONS',

    filePath: 'assets/app/',

    files: {},

    envText: "",

    options: {},

    msgPrefix: 'set-connection-options --',

    doDebugLog: true,

    debugLog: null,

    noop: function () {},
};


const self = global.connectionOptions;

setDoDebugLog(self.doDebugLog);

if (process.env[self.envName]) {

    self.options = readOptions(self.envName);

    checkOptions(self.options);

    fixupOptions(self.options);

    Mongo.setConnectionOptions(self.options);
}

/**
 * Read the contents of the environmental variable and covert it into an object
 *   substitute the default values if requested or if there is an error
 * @param envName
 * @returns {*}
 */
function readOptions(envName) {
    self.envText = process.env[self.envName];
    let text = self.envText;

    let options = self.ssl_defaultOptions;

    // self.useDefaults = (typeof text === 'string') ? self.useDefaultsKeywords[text] : "";
    //
    // if (self.useDefaults) {
    //     if (typeof self[self.useDefaults] === 'object') {
    //         options = self[self.useDefaults];
    //     } else if (typeof self[self.useDefaults + '_defaultOptions'] === 'object') {
    //         options = self[self.useDefaults + '_defaultOptions'];
    //     } else {
    //         options = self.ssl_defaultOptions;
    //     }
    // } else {
    //     try {
    //         options = JSON.parse(text);
    //     } catch (error) {
    //         console.log('??? Syntax Error: "%s" parsing env:%s: "%s"',
    //                     error.message, self.envName, self.envText
    //         );
    //         options = self.ssl_defaultOptions;
    //         console.log('??? Using default ssl connnection options: %s', JSON.stringify(options));
    //         console.log('??? To use default settings set env:%s to any of the following: ', self.envName)
    //         console.log('       "%s".', Object.keys(self.useDefaultsKeywords).join(", "));
    //     }
    // }
    return options;
}

/**
 * Warn the user about any options that should not be set or that are set wrong
 * @param options
 */
function checkOptions(options) {
    if (typeof options.ssl !== 'undefined') {
        console.log('%%%Warning -- do not set ssl=xxx in env:%s.  You must do so in the database uri. %%%', self.envName);
    }
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

function foundDefault(value) {
    let defaultName = value + '_defaultOptions';
    if (typeof self[defaultName] !== 'undefined') {
        self.options = self[defaultName];
    } else {
        Console.log('%s Unrecognized default option: "%s".  Valid values: "%s"',
                    self.msgPrefix, value, self.defaultOptionNames.join('", "')
        );
    }
}

function allowAny(value) {
    self.allowAny = !!value;
    self.debugLog("%s allowAny = '%s'", self.msgPrefix, self.allowAny);
}
function setDoDebugLog(value) {
    self.doDebugLog = !!value;
    if (self.doDebugLog) {
        self.debugLog = console.log.bind(self);
    } else {
        self.debugLog = self.noop.bind(self);
    }
}
function readFile(value, entry) {
    return readFilePath(self.filePath + value, entry);
}

function readFilePath(fileName, entry) {
    self.debugLog("%s reading '%s' -> '%s'", self.msgPrefix, self.entry, fileName);
    let result = null;
    try {
        if (!self.files[fileName]) {
            self.files[fileName] = fs.readFileSync(fileName);
        }
        result = self.files[fileName];
    } catch (error) {
        console.log("%s Unable to read '%s' error: %s", self.msgPrefix, entry, fileName);
    }
    self.debugLog("   --> found file with %d bytes.", result ? result.length : 0);
    return result;     // Only need to read it once
}

function readEnv(value, entry) {
    self.debugLog("%s reading '%s'", self.msgPrefix, entry);
    let result = "";
    if (typeof process.env[result] !== 'undefined') {
        result = process.env[result];
    } else {
        console.log("%s Unable to read '%s' not defined", self.msgPrefix, entry)
    }
    self.debugLog("  --> read: '%s'", result);
}

