
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
