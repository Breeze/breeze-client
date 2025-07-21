/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: 1,
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  setupFilesAfterEnv: ["jest-extended/all"],
  transform: {
      "^.+\\.m?js$": "ts-jest"
    },  
  transformIgnorePatterns: ['/node_modules/(?!breeze-client)']
};