### Used for aocrobot to query robot usage time data and save to public/robot-usage-cache.json then expose the api on http://robot.cmidict.info:3433/robot-usage-cache.json for aocrobot application(deployed in PPA VM) to query the robot usage

#### Dependency & Usage:

##### 1. Install nodejs(v22.16.0 and above)
##### 2. Update nodejs path in cronTask.sh
    > export PATH=/your/path/to/nodejs/bin:$PATH
##### 3. Add the script to system crontab task.
    > */3 * * * * /home/fedora/Apps/aocrobot/cronTask.sh

#### 4. Ensure nginx service enabled and actived.
    > systemctl enable nginx.service
    > systemctl start nginx.service
    