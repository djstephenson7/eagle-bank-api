const mockLogger = jest.fn();

module.exports = () => ({
  error: mockLogger
});

module.exports.mockLogger = mockLogger;
