# eskopal:set-connection-options

Meteor Atmosphere Package to allow you to pass in additional
[connection settings](http://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/)
 to Mongo that are not supported by the
[URI Connection String](https://docs.mongodb.org/manual/reference/connection-string/) format.

i.e. You can set useful things like `ssl`, `sslCA`, `sslCert`, `connectTimeoutMS`, `authSource` etc.

At a minimum, you must set MONGO_SCO_DEFAULT=ssl;

This results in the default configruation of:
```JSON
    {
        sslCA: ["@caCert.pem"],     // Array of valid certificates for Certificate Authority either as Buffers or Strings.
        sslCert: "@clientCert.pem", // String or buffer containing the client certificate.
        sslCRL: [],                 // Array of revocation certificates as Buffers or Strings.
        sslKey: "@clientCert.pem",  // Optional private keys in PEM format
        sslPass: null,              // String or buffer containing the client certificate password.
        sslValidate: true,          // Validate server certificate against certificate authority.
    },
```

## Notes

* Requires Meteor v1.4+, it uses the
[Mongo.setConnectionOptions](https://github.com/meteor/meteor/pull/7277) method (thanks [@dburles](https://github.com/dburles))

## Use

1. `meteor add eskopal:set-connection-options`
2. Open your `.meteor/packages` file, and place `eskopal:set-connection-options` at the top of the package list
(to ensure connection options are set prior to other packages using Mongo).
3. Add your settings as env var `MONGO_CONNECTION_xxxx`, e.g.

```shell
 export MONGO_CONNECTION_sslCA='file:caCert.xyz'
```

If the env var is not set on startup, the package does nothing.
