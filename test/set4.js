var fs         = require('fs');
var crypto     = require('crypto');
var expect     = require('expect.js');
var http       = require('http');
var utils      = require('../src/utils.js');
var encryption = require('../src/encryption.js');
var oracles    = require('../src/oracles.js');
var mac        = require('../src/mac.js');
var hmac       = require('../src/hmac.js');

describe('Set 4', function() {
  describe('Challenge 25 - Break r/w AES CTR', function() {
    // Decrypt the ECB coded input
    var bufRaw = new Buffer(fs.readFileSync('resources/25.txt', 'ascii'), 'base64');
    var bufKey = new Buffer('YELLOW SUBMARINE');
    var bufPt  = encryption.aesECB.decrypt(bufRaw, bufKey);

    // Re-encrypt under CTR with random key
    var bufRandK = crypto.randomBytes(16);
    var bufCt    = encryption.aesCTR.encrypt(bufPt, bufRandK);

    it('should be able to edit the encrypted text', function() {
      var egg    = new Buffer('n00bn00b');
      var offset = 5;
      var bufNew = encryption.aesCTR.editCt(bufCt, bufRandK, offset, egg);
      var result = encryption.aesCTR.decrypt(bufNew, bufRandK);

      expect(result.slice(offset, offset + egg.length)).to.eql(egg);
    });

    it('should be able to decrypt the ciphertext using the edit function', function() {
      var result = oracles.randomAccessRW.reveal(bufCt, bufRandK, encryption.aesCTR.editCt);
      
      expect(result).to.eql(bufPt);
    });
  });

  describe('Challenge 26 - CTR bitflipping attacks', function() {
    it('should inject an admin token', function() {
      var bufKey = crypto.randomBytes(16);
      //
      // Examine the known blocks:
      // [ "comment1=cooking", "%20MCs;userdata=", "xxxxxxxxxxxxxxxx", 
      //   ";comment2=%20lik","e%20a%20pound%20", "of%20bacon" ]
      //
      // We can retrieve the keystream from the block which we control
      //
      // Input we control -> block[2]
      var sData = 'xxxxxxxxxxxxxxxx';

      // String to inject
      var bufInject = new Buffer('xxxx;admin=true;');

      // Ciphertext with our data input
      var bufCt = 
        utils.webApp.encryptCommentString(
          encryption.aesCTR.encrypt,
          sData, 
          bufKey 
        );

      // Now retrieve keystream from block we control CT[2] XOR 'xxxxxxxxxxxxxxxx'
      var blocks         = utils.blocks(bufCt, 16);
      var keystreamBlock = utils.xor.bytes(blocks[2], new Buffer(sData));

      // Now generate the encrypted 'xxxx;admin=true;' block
      var bufExploit = utils.xor.bytes(bufInject, keystreamBlock);

      // Now splice together and we should have an admin token
      blocks.splice(2, 0, bufExploit);
      bufCt = Buffer.concat(blocks);


      expect(
        utils.webApp.isAdminComment(
          encryption.aesCTR.decrypt, 
          bufCt, 
          bufKey
        )
      ).to.be(true);
    });
  });

  describe('Challenge 27 - Recover key from CBC with IV=Key', function() {
    it('should recover the key by forcing a server error that reveals plaintext', function() {
      // Create a secret key
      var bufSecret = crypto.randomBytes(16);
      
      // Encrypt a message AES-CBC(P_1, P_2, P_3) -> C_1, C_2, C_3
      var bufCt  = 
        utils.webApp.encryptCommentString(
          encryption.aesCBC.encrypt,
          '', 
          bufSecret 
        );

      // Modify the message C_1, C_2, C_3 -> C_1, 0, C_1
      var blocks = utils.blocks(bufCt, 16);
      blocks[1]  = new Buffer(16).fill('\x00');
      blocks[2]  = blocks[0];
      bufCt      = Buffer.concat(blocks); 

      // Feed the modified ciphertext back to the server
      var response = 
        utils.webApp.parseComment(
          encryption.aesCBC.decrypt, 
          bufCt, 
          bufSecret
        );

      var plainBlocks = utils.blocks(response.input, 16);

      //Extract the key from the response
      var bufKey = utils.xor.bytes(plainBlocks[0], plainBlocks[2]); 

      expect(bufKey).to.eql(bufSecret);
    });
  });

  describe('Challenge 28 - Implement SHA1 hash algorithm', function() {
    var bufM   = new Buffer('We all live in a what?');

    it('should pad a message to 512 bits multiple', function() {
      var bufM        = new Buffer(664 / 8).fill('A');
      var bufExpected = new Buffer(
        '41414141414141414141414141414141414141414141414141414141414141414141' + 
        '41414141414141414141414141414141414141414141414141414141414141414141' +
        '41414141414141414141414141414180000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000298', 'hex'
      );

      expect(utils.md.pad(bufM)).to.eql(bufExpected);
    });

    it('should produce the expected message digest', function() {
      var buf1 = new Buffer('cookin MCs like a pound of bacon');
      var buf2 = new Buffer('shall I compare thee to a summer\'s day');

      expect(mac.SHA1.digest(buf1)).to.eql(
        new Buffer('be120668f532ec01b9ca4d924999832281f79354', 'hex')
      );
      expect(mac.SHA1.digest(buf2)).to.eql(
        new Buffer('1b0d1a96f5f7daba86d38a54e9dd02ccc1e57916', 'hex')
      );
    });

    it('should produce a MAC given a message and secret key', function() {
      var bufPt  = Buffer.concat([new Buffer('YELLOW SUBMARINE'), bufM]);

      expect(mac.SHA1.authenticate(bufM)).to.eql(
        mac.SHA1.digest(bufPt)
      );
    });

    it('should verify a mac given message and key', function() {
      var bad  = crypto.randomBytes(20);
      var good = mac.SHA1.authenticate(bufM);
      
      expect(mac.SHA1.verify(bad, bufM)).to.eql(false);
      expect(mac.SHA1.verify(good, bufM)).to.eql(true);
    });
  });

  describe('Challenge 29 - break SHA1 MAC using key length extension', function() {
    it('should forge an extended url string with a valid MAC', function() {
      var bufOrig = new Buffer(
        'comment1=cooking%20MCs;userdata=foo;comment2=%20like%20a%20pound%20of%20bacon'
      );
      var bufMac  = mac.SHA1.authenticate(bufOrig);
      var bufMod  = new Buffer(';admin=true');
      var forgery = mac.SHA1.forgeMAC(bufMac, bufOrig, bufMod);
      
      // SHA-1 a031e37757a34f714a82b2ee3dcf93ba1dfebea5
      expect(forgery.msg.toString()).to.contain(bufMod.toString());
      expect(forgery.mac).to.eql(mac.SHA1.authenticate(forgery.msg));
    });
  });

  describe('Challenge 30 - break MD4 MAC using key length extension', function() {
    it.skip('should generate the expected output as per RFC 1320', function() {
      expect(mac.MD4.digest(new Buffer("")))
        .to.eql(new Buffer('31d6cfe0d16ae931b73c59d7e0c089c0', 'hex'));
      expect(mac.MD4.digest(new Buffer("message digest")))
        .to.eql(new Buffer('d9130a8164549fe818874806e1c7014b', 'hex'));
      expect(mac.MD4.digest(new Buffer("abcdefghijklmnopqrstuvwxyz")))
        .to.eql(new Buffer('d79e1c308aa5bbcdeea8ed63df412da9', 'hex'));
    });

    it.skip('should forge an extended url string with a valid MAC', function() {
    });
  });

  describe('Challenge 31 - break HMAC-SHA1 with artificial timing leak', function() {
    it('should return the expected HMAC-SHA1 digest as per RFC 2202', function() {
      // Test Case I
      var bufKey = new Buffer('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b', 'hex');
      var data   = new Buffer("Hi There");
      var digest = new Buffer('b617318655057264e28bc0b6fb378c8ef146be00', 'hex');
      expect(hmac.digest(mac.SHA1.digest, bufKey, data)).to.eql(digest);

      // Test Case II
      bufKey = new Buffer("Jefe");
      data   = new Buffer("what do ya want for nothing?");
      digest = new Buffer('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79', 'hex');

      expect(hmac.digest(mac.SHA1.digest, bufKey, data)).to.eql(digest);

      // Test Case III
      bufKey = new Buffer('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex');
      data   = new Buffer(50).fill(0xdd);
      digest = new Buffer('125d7342b9ac11cd91a39af48aa17b4f63f175d3', 'hex');

      expect(hmac.digest(mac.SHA1.digest, bufKey, data)).to.eql(digest);
    });

    it('the app should return a 500 status if HMAC is invalid', function(done) {
      var url  = 
        'http://localhost:9000/test?file=Jefe&signature=' + 
        'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79';

      http.get(url, function(res) {
        expect(res.statusCode).to.eql(500);
        done();
      });
    });

    it('the app should return a 200 status if the HMAC is valid', function(done) {
      var url = 
        'http://localhost:9000/test?file=Jefe&signature=' +
        'efc0ecef8b4bca37abc4325697b4c8ac47d148be';

      http.get(url, function(res) {
        expect(res.statusCode).to.eql(200);
        done();
      });
    });

    it('should discover the valid mac for any file through a timing attack with 50ms delay', function() {
      // Do this through an external script as node sucks at this kind of thing and it's very slow (30mins)!
      //
      // Script in /scripts/timing_discovery.rb
      //
      // Usage: #{__FILE__} <target url> <mac guess>
      //
      // $ ./timing_discovery.rb 'http://localhost:9000/test?file=Jefe&signature=' 'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79'
      // [+] Starting timing attack....
      // [+] Calculating...efc0ecef8b4bca37abc4325697b4c8ac47d148ff
      // [+] Done
      // [+] Checking validity....
      // [+] Success: efc0ecef8b4bca37abc4325697b4c8ac47d148be
    });
  });

  describe('Challenge 32 - Break HMAC-SHA1 with less artificial timing leak', function() {
    it('should discover the valid mac for any file through a timing attack with 5ms delay', function() {
      // A more sophisticated version of the previous challenge. Rather than a single request use multiple and
      // compare average response times
      //
      // Script in /scripts/timing_discovery_II.rb
      //
    });
  });
});


