(function() {
    // Get application context
    var app = Sammy.apps['#main'];
    var store = app.store;

    /**
     * Home
     *
     */

     // Home page
    app.get('#/', function (c) {
        c.view("home");
        // N.B : if you need to run stuff at login time,
        // see js/events.js instead
    });

    /**
     * Login
     *
     */

    app.get('#/login', async function (c) {
        $('#masthead').show()
            .find('.logout-btn').hide();
        store.set('path-1', '#/login');

        c.showLoader();

        // We gonna retry 3 times to check if yunohost is installed
        if (app.isInstalledTry === undefined) {
            app.isInstalledTry = 3;
        }

        c.checkInstall(function(isInstalled) {

            if (isInstalled) {
                c.view('login', { 'domain': window.location.hostname });
                return;
            }

            if (typeof isInstalled !== 'undefined') {
                c.redirect('#/postinstall');
                return;
            }

            // If the retry counter is still up, retry this function 5 sec
            // later
            if (app.isInstalledTry > 0) {
                app.isInstalledTry--;
                setTimeout(function() {
                    c.redirect('#/');
                }, 5000);
            }
            else {
                c.flash('fail', y18n.t('api_not_responding'));
            }
        });
    });


    /**
     * Logout
     *
     */

    app.post('#/login', function (c) {
        // Store url from params, it could have change form 'run' state
        store.set('url', c.params['domain'] +'/yunohost/api');

        const params = {
            password: c.params['password']
        }
        // Can't use `await` here because Sammy can't handle `async` callback in post
        // request (triggers a 405)
        c.apiNew('/login', {
            method: 'POST', type: 'text', params, websocket: false
        }).then(output => {
            const [err, data] = output;
            if (err) return;

            store.set('connected', true);
            c.trigger('login');
            $('#masthead .logout-btn').fadeIn();
            c.flash('success', y18n.t('logged_in'));
            if (store.get('path')) {
                c.redirect(store.get('path'));
            } else {
                c.redirect('#/');
            }
        });
    });

    app.get('#/logout', async function (c) {
        const [err, data] = await c.apiNew('/logout', {type: 'text', websocket: false});
        if (err) return;

        store.clear('url');
        store.clear('connected');
        store.set('path', '#/');
        c.trigger('logout');
        c.flash('success', y18n.t('logged_out'));
        c.redirect('#/login');
    });

})();
