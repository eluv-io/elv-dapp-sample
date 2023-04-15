#
# The deploy targets are for internal Eluvio use
#

build:
	npm install

build_apps:
	npm run build-cross-chain-media
	npm run build-dapp-sample

clean:
	rm -rf dist/ test/dist/

run_ds:
	@echo :8094
	npm run serve-dapp-sample

run_ccm:
	@echo :8094
	npm run serve-cross-chain-media

deploy_ds:
	cp firebase-ds.json firebase.json
	firebase use production-260101
	npm run build-dapp-sample && firebase deploy --only hosting:elv-dapp-sample

deploy_ccm:
	cp firebase-ccm.json firebase.json
	firebase use production-260101
	npm run build-cross-chain-media && firebase deploy --only hosting:elv-cross-chain-media

