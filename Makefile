
default: run_ds

build:
	npm install

build_apps:
	NODE_OPTIONS=--openssl-legacy-provider npm run build-cross-chain-media
	NODE_OPTIONS=--openssl-legacy-provider npm run build-dapp-sample

clean:
	rm -rf dist/ test/dist/

run_ds:
	@echo :8094
	open https://elv-test.io:8094/?network-name=demo
	NODE_OPTIONS=--openssl-legacy-provider npm run serve-dapp-sample

run_ccm:
	@echo :8094
	NODE_OPTIONS=--openssl-legacy-provider npm run serve-cross-chain-media
