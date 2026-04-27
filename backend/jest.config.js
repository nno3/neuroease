/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.js'],
    setupFiles: ['<rootDir>/tests/setup.js'],
    testTimeout: 30000,
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    // Default would skip all of node_modules; allow transpiling ESM `uuid@14+` for Sequelize.
    transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
};
