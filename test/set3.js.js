var fs         = require('fs');
var expect     = require('expect.js');
var utils      = require('../src/utils.js');
var encryption = require('../src/encryption.js');
var analyzers  = require('../src/analyzers.js');
var oracles    = require('../src/oracles.js');

describe('Set 3', function() {
  describe('Challenge 18  - Implement AES in CTR mode', function() {
    var bufCt  = 
      new Buffer('L77na/nrFsKvynd6HzOoG7GHTLXsTVu9qvY/2syLXzhPweyyMTJULu/6/kXX0KSvoOLSFQ==', 'base64');
    var bufKey    = new Buffer('YELLOW SUBMARINE');
    var bufNonce  = new Buffer(8).fill('\x00');
    var plaintext = encryption.aesCTR.decrypt(bufCt, bufKey, bufNonce);

    it('should increment a little endian ctr', function() {
      var bufCtr = new Buffer(8).fill('\x00', 'ascii');
      var once   = encryption.aesCTR.littleEndIncrement(bufCtr);
      var many   = new Buffer(8).fill('\x00', 'ascii');

      expect(once).to.eql(new Buffer('\x01\x00\x00\x00\x00\x00\x00\x00', 'ascii'));

      for (var i =0; i < 256; i++) {
        many = encryption.aesCTR.littleEndIncrement(bufCtr);
      }
      expect(many).to.eql(new Buffer('\xff\x02\x00\x00\x00\x00\x00\x00', 'ascii'));
    });

    it('should decrypt a AES::CTR encrypted ciphertext given nonce and key', function() {
      expect(plaintext).to.eql(new Buffer('Yo, VIP Let\'s kick it Ice, Ice, baby Ice, Ice, baby '));
    });

    it('should encrypt in AES::CTR mode', function() {
      expect(encryption.aesCTR.encrypt(plaintext, bufKey, bufNonce)).to.eql(bufCt);
    });
  });

  describe('Challenge 19 - break fixed nonce CTR', function() {

  });
});
