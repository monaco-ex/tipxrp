FROM node:8-onbuild

WORKDIR /usr/src/app

CMD ["bin/hubot","-a","twitter-userstream-monacoex"]
