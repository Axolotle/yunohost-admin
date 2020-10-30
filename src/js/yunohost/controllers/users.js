(function() {
    // Get application context
    var app = Sammy.apps['#main'];
    var store = app.store;

    var PASSWORD_MIN_LENGTH = 4;

    /**
     * Groups and permissions
     *
     */

    /**
     * Update group or permissions
     *
     * @model data organize in the same way than /users/groups?full&include_primary_groups
     * @params.operation "add"|"remove"
     * @params.type "members"|"permissions"
     * @param.item Name of the user or the permission to add or remove
     * @param.group Name of the group affected
     *
     * This function is built to be apply with params generated by the use of
     * HTML dataset attributes (e.g. link in the partial inline view "label" in group_list.ms)
     *
     * @return void
     **/
    function updateGroup(model, params) {
        var type = params.type;
        var action = params.action;
        var item = params.item;
        var groupname = params.group;
        var group = data.groups[groupname];
        var to = (action == 'add')?group[type]:group[type + 'Inv'];
        var from = (action == 'add')?group[type+'Inv']:group[type];
        // Do nothing, if array of destination already contains the item
        if (from.indexOf(item) === -1) return;

        // Hack to disable pacman loader if any
        if ($('div.loader').length === 0) {
            $('#main').append('<div class="loader loader-content" style="display: none"></div>');
        }
        $('div.loader').css('display', 'none');

        // Update group
        var params = {}; var url;
        if (type == 'members') {
            url = '/users/groups/' + groupname;
            params[action] = [item];
        }
        else {
            url = '/users/permissions/' + item;
            params[action] = [groupname];
        }
        c.api('PUT', url, params, function(data_update) {
            to.push(item);
            from.splice(from.indexOf(item), 1);
            updateView(data);
        });
    }

    /**
     * Update the view with the new model
     *
     * @model data organize in the same way than /users/groups?full&include_primary_groups
     *
     * @return void
     **/
    function updateView(model) {
        // Sort in aphanumerical order to improve user experience
        for (var group in model.groups) {
            model.groups[group].permissions.sort();
            model.groups[group].permissionsInv.sort();
            model.groups[group].members.sort();
            model.groups[group].membersInv.sort();
        }

        // Manual render, we don't use c.view to avoid scrollTop and other
        // uneeded behaviour
        var rendered = c.render('views/user/group_list.ms', model);
        rendered.swap(function () {
            // Add click event to get a nice "reactive" interface
            $("button[data-action='add'], button[data-action='remove']").on('click', function (e) {
                updateGroup(model, $(this)[0].dataset);
                return false;
            });
            $('button[data-action="add-user-specific-permission"]').on('click', function (e) {
                data.groups[$(this).data("user")].display = true;
                updateView(data);
                return false;
            });
            $('button[data-action="delete-group"]').on('click', function (e) {

                var group = $(this).data("group");

                c.confirm(
                    y18n.t('groups'),
                    $('<div>'+ y18n.t('confirm_delete', [group]) +'</div>'),
                    function() {
                        c.api('DELETE', '/users/groups/'+ group, {}, function(data) { c.refresh(); });
                    }
                );
            });
        });
    }


    app.get('#/groups', function (c) {
        c.api('GET', '/users/groups?full&include_primary_groups', {}, function(data_groups) {
        c.api('GET', '/users', {}, function(data_users) {
        c.api('GET', '/users/permissions?full', {}, function(data_permissions) {
            //var perms = data_permissions.permissions;
            var specific_perms = {};
            var all_perms = data_permissions.permissions;
            var users = Object.keys(data_users.users);

            // Enrich groups data with primary group indicator and inversed items list
            for (var group in data_groups.groups) {
                data_groups.groups[group].primary = users.indexOf(group) !== -1;
                data_groups.groups[group].permissionsInv = Object.keys(all_perms).filter(function(item) {
                    return data_groups.groups[group].permissions.indexOf(item) === -1;
                }).filter(function(item) {
                    // Remove 'email', 'xmpp' and protected permission in visitors's permission choice list
                    return group != "visitors" || (item != "mail.main" && item != "xmpp.main" && ! all_perms[item].protected == true);
                });
                data_groups.groups[group].membersInv = users.filter(function(item) {
                    return data_groups.groups[group].members.indexOf(item) === -1;
                });
            }

            // Declare all_users and visitors has special
            data_groups.groups['all_users'].special = true;
            data_groups.groups['visitors'].special = true;

            // Data given to the view with 2 functions to convert technical
            // permission id to display names
            data = {
                'groups':data_groups.groups,
                'displayPermission': function (text) {
                    return all_perms[text].label;
                },
                'displayUser': function (text) {
                    return text;
                },
                'is_protected': function (item, type, group) {
                    if (type == 'permission' && group == 'visitors') {
                        return all_perms[item].protected;
                    } else {
                        return false
                    }
                },
            };
            updateView(data);
        });
        });
        });
    });

    // Create a new group
    app.get('#/groups/create', function (c) {
        c.view('user/group_create', {});
    });

    app.post('#/groups/create', function (c) {
        c.params['groupname'] = c.params['groupname'].replace(' ', '_').toLowerCase();
        c.api('POST', '/users/groups', c.params.toHash(), function(data) {
            c.redirect_to('#/groups');
        });
    });

    /**
     * Users
     *
     */

    // List existing users
    app.get('#/users', function (c) {
        c.api('GET', '/users', {}, function(data) {
            c.view('user/user_list', data);
        });
    });

    // Create user form
    app.get('#/users/create', function (c) {
        c.api('GET', '/domains', {}, function(data) {

            // Password min length
            data.password_min_length = PASSWORD_MIN_LENGTH;
            c.view('user/user_create', data, function(){
                var usernameField = $('#username');
                usernameField.on('input', function(){
                    var emailLeft = $('#email-left');
                    emailLeft.html(usernameField.val());
                });
            });
        });
    });

    // Create user (POST)
    app.post('#/users/create', function (c) {
        if (c.params['password'] == c.params['confirmation']) {
            if (c.params['password'].length < PASSWORD_MIN_LENGTH) {
                c.flash('fail', y18n.t('passwords_too_short'));
            }
            else {
                // Force unit or disable quota
                if (c.params['mailbox_quota']) {
                    c.params['mailbox_quota'] += "M";
                }
                else {c.params['mailbox_quota'] = 0;}
                c.params['domain'] = c.params['domain'].slice(1);

                c.api('POST', '/users', c.params.toHash(), function(data) {
                    c.redirect_to('#/users');
                });
            }
        } else {
            c.flash('fail', y18n.t('passwords_dont_match'));
        }
    });

    // Show user information
    app.get('#/users/:user', function (c) {
        c.api('GET', '/users/'+ c.params['user'], {}, function(data) {
            c.view('user/user_info', data, function() {

                // Configure delete button behavior
                $('button[data-action="delete"]').on("click", function() {
                    var user = $(this).data("user");

                    var params = {};

                    // make confirm content
                    var purgeCheckbox = '<div><input type="checkbox" id="purge-user-data" name="purge-user-data"> <label for="purge-user-data">'+ y18n.t('purge_user_data_checkbox', [user]) +'</label></div>';
                    var purgeAlertMessage = '<div class="danger" style="display: none">⚠ '+ y18n.t('purge_user_data_warning') +'</div>';
                    var confirmModalContent = $('<div>'+ y18n.t('confirm_delete', [user]) +'<br><br>'+ purgeCheckbox +'<br>'+ purgeAlertMessage +'</div>');

                    // display confirm modal
                    c.confirm(
                        y18n.t('users'),
                        confirmModalContent,
                        function(){
                            c.api('DELETE', '/users/'+ user, params, function(data) {
                                c.redirect_to('#/users');
                            });
                        }
                    );

                    // toggle purge warning and parameter
                    confirmModalContent.find("input").click(function(){

                        if (confirmModalContent.find("input").is(':checked')) {
                            params.purge = "";
                            confirmModalContent.find(".danger").show();
                        }
                        else {
                            delete params.purge;
                            confirmModalContent.find(".danger").hide();
                        };
                    });
                });
            });
        });
    });

    // Edit user form
    app.get('#/users/:user/edit', function (c) {
        c.api('GET', '/users/'+ c.params['user'], {}, function(data) {
            c.api('GET', '/domains', {}, function(dataDomains) {

                // Password min length
                data.password_min_length = PASSWORD_MIN_LENGTH;

                // User email use a fake splitted field
                var email = data.mail.split('@');
                data.email = {
                    username : email[0],
                    domain : email[1]
                };

                // Return quota with M unit
                if (data['mailbox-quota'].limit) {
                    var unit = data['mailbox-quota'].limit.slice(-1);
                    var value = data['mailbox-quota'].limit.substr(0, data['mailbox-quota'].limit.length -1);
                    if (unit == 'b') {
                        data.quota = Math.ceil(value / (1024 * 1024));
                    }
                    else if (unit == 'k') {
                        data.quota = Math.ceil(value / 1024);
                    }
                    else if (unit == 'M') {
                        data.quota = value;
                    }
                    else if (unit == 'G') {
                        data.quota = Math.ceil(value * 1024);
                    }
                    else if (unit == 'T') {
                        data.quota = Math.ceil(value * 1024 * 1024);
                    }
                }
                else {data.quota = 0;}

                // Domains
                data.domains = [];
                $.each(dataDomains.domains, function(key, value) {
                    data.domains.push({
                        domain: value,
                        selected: (value == data.email.domain) ? true : false
                    });
                });

                c.view('user/user_edit', data);
            });
        });
    });

    // Update user information
    app.put('#/users/:user', function (c) {
        // Get full user object
        c.api('GET', '/users/'+ c.params['user'], {}, function(user) {
            // Force unit or disable quota
            if (c.params['mailbox_quota']) {
                c.params['mailbox_quota'] += "M";
            }
            else {c.params['mailbox_quota'] = 0;}

            // concat email/domain pseudo field
            if (c.params['mail'] !== c.params['email'] + c.params['domain']) {
                c.params['mail'] = c.params['email'] + c.params['domain'];
            }
            else {
                c.params['mail'] = '';
            }
            // Clear temporary inputs
            c.params['email'] = c.params['domain'] = '';


            // force array type for mail aliases and redirections
            if (typeof c.params['mailalias'] == 'string') {c.params['mailalias'] = [c.params['mailalias']];}
            if (typeof c.params['mailforward'] == 'string') {c.params['mailforward'] = [c.params['mailforward']];}

            // Check for added/removed aliases and redirections
            c.params['add_mailalias'] = c.arrayDiff(c.params['mailalias'], user['mail-aliases']);
            c.params['remove_mailalias'] = c.arrayDiff(user['mail-aliases'], c.params['mailalias']);
            c.params['add_mailforward'] = c.arrayDiff(c.params['mailforward'], user['mail-forward']);
            c.params['remove_mailforward'] = c.arrayDiff(user['mail-forward'], c.params['mailforward']);

            // Clear temporary inputs
            c.params['mailalias'] = c.params['mailforward'] = '';

            // Remove empty inputs
            var params = {};
            $.each(c.params.toHash(), function(key, value) {
                if (value.length > 0 && key !== 'user') { params[key] = value; }
            });

            if ($.isEmptyObject(params)) {
                c.flash('fail', y18n.t('error_modify_something'));
                c.redirect_to('#/users/'+ c.params['user'] + '/edit', {slide: false});
            } else {
                if (params['password']) {
                    if (params['password'] == params['confirmation']) {
                        if (params['password'].length < PASSWORD_MIN_LENGTH) {
                            c.flash('fail', y18n.t('passwords_too_short'));
                            c.redirect_to('#/users/'+ c.params['user'] + '/edit', {slide: false});
                        }
                        else {
                            params['change_password'] = params['password'];
                            c.api('PUT', '/users/'+ c.params['user'], params, function(data) {
                                c.redirect_to('#/users/'+ c.params['user']);
                            });
                        }
                    } else {
                        c.flash('fail', y18n.t('passwords_dont_match'));
                        c.redirect_to('#/users/'+ c.params['user'] + '/edit', {slide: false});
                    }
                }
                else {
                    c.api('PUT', '/users/'+ c.params['user'], params, function(data) {
                        c.redirect_to('#/users/'+ c.params['user']);
                    });
                }
            }
        });
    });

})();
