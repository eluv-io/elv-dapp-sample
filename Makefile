#
# currently only used for the wallet-ops-deploy, which is the source of https://dapp-sample.app.eluv.io/
#

build:
	npm install

clean:
	rm -rf dist/

run:
	@echo :8094
	npm run serve-wallet-ops-test

deploy:
	firebase use production-260101
	npm run build-wallet-ops-test && firebase deploy --only hosting:elv-dapp-sample
