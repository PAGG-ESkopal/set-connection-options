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

    // Currently only a default set of SSL connection options is defined.
    // any of the following keywords will cause it to be used.
    // Additional keywords and default options can be defined.
    useDefaultsKeywords: {
        'default=sslX509': 'ssl',
        'default=X509': 'ssl',
        'default=ssl': 'ssl',
        'ssl=X509': 'ssl',
        'sslX509': 'ssl',
        'sslX509=true': 'ssl',
        'ssl': 'ssl',
        'ssl=true': 'ssl'
    },

    // Define a set of default options support SSL and X509 validation

    sslDefaultOptions: {
        sslCA: ["@caCert.pem"],     // Array of valid certificates for Certificate Authority either as Buffers or Strings.
        sslCert: "@clientCert.pem", // String or buffer containing the client certificate.
        sslCRL: [],                 // Array of revocation certificates as Buffers or Strings.
        sslKey: "@clientCert.pem",  // Optional private keys in PEM format.
        sslPass: null,              // String or buffer containing the client certificate password.
        sslValidate: true,          // Validate server certificate against certificate authority.
    },

    envName: 'MONGO_CONNECTION_OPTIONS',

    files: {},

    envText: "",

    options: {},
};

const self = global.connectionOptions;

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

    let options = self.sslDefaultOptions;

    self.useDefaults = (typeof text === 'string') ? self.useDefaultsKeywords[text] : "";

    if (self.useDefaults) {
        if (typeof self[self.useDefaults] === 'object') {
            options = self[self.useDefaults];
        } else if (typeof self[self.useDefaults + 'DefaultOptions'] === 'object') {
            options = self[self.useDefaults + 'DefaultOptions'];
        } else {
            options = self.sslDefaultOptions;
        }
    } else {
        try {
            options = JSON.parse(text);
        } catch (error) {
            console.log('??? Syntax Error: "%s" parsing env:%s: "%s"',
                        error.message, self.envName, self.envText
            );
            options = self.sslDefaultOptions;
            console.log('??? Using default ssl connnection options: %s', JSON.stringify(options));
            console.log('??? To use default settings set env:%s to any of the following: ', self.envName)
            console.log('       "%s".', Object.keys(self.useDefaultsKeywords).join(", "));
        }
    }
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
                return fixupEntry(entry);
            })
        } else {
            options[name] = fixupEntry(value);
        }
    });
}

/**
 * Read each entry in the options and replace any that start with @
 *  by reading the file with the same name located in the private directory.
 * @param entry
 * @returns {*}
 */
function fixupEntry(entry) {
    if (typeof entry === 'string') {
        if (entry.startsWith('@')) {
            try {
                let fileName = 'assets/app/' + entry.substr(1);
                if (!self.files[fileName]) {
                    self.files[fileName] = fs.readFileSync(fileName);
                }
                return self.files[fileName];     // Only need to read it once
            } catch (error) {
                console.log('Unable to read "%s" found in env:%s', entry, self.envName);
            }
        }
    }
    return entry;
}
