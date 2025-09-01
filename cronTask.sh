#!/bin/bash

cd /home/fedora/Apps/aocrobot/
echo "sync robot usage...." >> /tmp/robotusage.log
export PATH=/home/fedora/Apps/node-v22.16.0-linux-x64/bin:$PATH
export SCRAPER_EMAIL='lizhenghuang@cmi.chinamobile.com'
export SCRAPER_PASSWORD='robotAtPpa9'

node syncUsageDataTask.js >> /tmp/robotusage.log 2>&1

