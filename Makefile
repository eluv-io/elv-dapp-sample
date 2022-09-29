#
# currently only used for the wallet-ops-deploy
#

build:
	npm install

clean:
	rm -rf dist/

deploy:
	firebase use production-260101
	npm run build-wallet-ops-test && firebase deploy --only hosting:elv-dapp-sample	

wallet-ops:
	@echo :8094
	npm run serve-wallet-ops-test

media-wallet:
	@echo :8090
	npm run serve-https

client-test:
	@echo :8092
	npm run serve-client-test

login-test:
	@echo :8093
	npm run serve-login-test


xco:
	curl -s 'https://host-216-66-89-94.contentfabric.io/qlibs/ilib4VkoL3vt75eWwvjHqqyyzxwExWV9/q/hq__JHFZaD9f4q8LqZNANFq8MLhjRRMAXxSjKRwqR9KdBEydAH7Bb6XkdV2s7dNJQ6W4KPzHFct87c/rep/playout/default/hls-aes128/playlist.m3u8?resolve=true&sid=52FB36EA7504&player_profile=hls-js' -H 'Authorization: Bearer acspjc2ELNd7Fua7oMMGi1tELKjgy6PJMzx1ENvxEo6ky58xenAAzhWdyG8abLhqCr5zXhMqN7oPVY5CW9wVT3Giz1DhWFkuPFgrs165EHBxgqhMrSiFvQBSsgwM7cL776Z9hBE9pKjF8AE2Ar6DCahALzNkxWDoCYACiXon8wTC4VaUyjEFAWdhJAQY4ZWiKcVwYnPUHBqPPtihNLV7xt8jfp7YWoKEHTZE3y9VMseHkrKgAioyaM4ATDJCfemzqaQGPvNcwkDP1roQoSMwQfvTCHgZZf9nTMBNgipJKUePvfsGhRTvHbJT1c5Mynsg3EUwoMz8SsW9owiW3LBBVvxYisTNrcx1wUdsGiB5f8CtECk4DfVnkBj8Ree9aFQHsy4JbQR7MbQLzcRUpqg4ioa1wUYMSQEJw91RZ8QsCJ1pEWpk9nu3wu1tni7K2Fuc6xMuEqsqtpfcMufVEKbWy5odc1Ae53CZUXJZwYJTTLUZgJyhR9HJPrCWz'
	curl 'https://host-216-66-89-94.contentfabric.io/q/hq__JHFZaD9f4q8LqZNANFq8MLhjRRMAXxSjKRwqR9KdBEydAH7Bb6XkdV2s7dNJQ6W4KPzHFct87c/meta/public?select=name&select=nft&select=asset_metadata%2Ftitle&select=asset_metadata%2Fdisplay_title&select=asset_metadata%2Fnft&link_depth=1&resolve=false&resolve_include_source=false&resolve_ignore_errors=false' \
  -H 'Authorization: Bearer acspjcQjqCej5wKBuiHgsTo4fbUzwHyirLcnCvPnheoWhANvght6BiTieonnQfsnFb89ubx1D5FmCVJdh8oG7HwTZUV92XSwy6ezAGyvpDrseZ8U8EtqWmauDJkoFoZjLopnki6NrHPudf2DjxibEZ7K3junSvYnb3kddQ2Svu9XkaJkCkMDSZ4mkboCkBoscSBHn93DU9XBLfVvb63tFuertGe1WVxucwcZr73iHoc67LmoWh558nMmDHhKsJVtRbtuw8VFwz352NKbtTLVKoYVsrVUY1GPaxSkkFxoeGv9RUMxtb2Be9UDZJ8EQ7seAMcwk58zFVLwLSRMe5z7Ak9FrsVif9jdE7XCmK3pSHWRQBXJWcLvNuNVwCys9i6xa1Gxs99hZCqDKbgKu2akVgYWM7g7QEAcHTZLMtHmry6uftG7efShZNw2jca56NHhMjXjESHVnn,Bearer eyJxc3BhY2VfaWQiOiJpc3BjM0FOb1ZTek5BM1A2dDdhYkxSNjlobzVZUFBaVSJ9' \
  --compressed

