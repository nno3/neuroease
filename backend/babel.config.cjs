/**
 * Jest needs to transpile the `uuid` v14+ package (ESM) when Sequelize `require()`s it.
 * Only `node_modules/uuid` is exempted from the default "ignore" list (see jest.config.js).
 */
module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: { node: '18' },
            },
        ],
    ],
};
