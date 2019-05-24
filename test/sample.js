const app = require('../index');

const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
chai.should();

describe('API /healthz', () => {
    it('it should return 200', (done) => {
        chai.request(app)
            .get('/healthz')
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
    });
});

describe('API GET/', () => {
    it('it should JSON data', (done) => {
        chai.request(app)
            .get('/?url=https://e2e:3ndT0End@dev-preview-www.handelsblatt.com/contentexport/feed/theme?cxpid=13906102')
            .end((err, res) => {
                res.should.have.status(200);
                res.should.to.be.json;
                //res.text.should.be.equal("Hello Docker World\n");
                done();
            });
    });
});

describe('API POST/', () => {
    it('it should a content ID', (done) => {
        chai.request(app)
            .post('/?url=https://e2e:3ndT0End@dev-preview-www.handelsblatt.com/urlresolver')
            .set('Accept', 'text/plain')
            .set('content-type', 'text/plain')
            .send('/themen/tesla')
            .end((err, res) => {
                res.should.have.status(200);
                res.text.should.be.equal("13906102");
                res.should.to.be.text;
                
                //res.body.length.should.be.eql(0);
                done();
            });
    });
});
