import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Storage } from '@ionic/storage';
import { Config } from '../../services/config.service'
import { Http } from '@angular/http';
import { User } from '../../models/user'

declare const FB: any;

@Injectable()
export class AuthenticationService {
  private storage: Storage;
  public User: User;
  public IsConnected: Boolean;

  constructor(public http: Http, private config: Config) {
    this.storage = new Storage();
    this.IsConnected = false;
  }

  public IsAuthenticated() {

    return this.storage.get("user");
  }

  public Initialize() {
    FB.init({
      appId: '1203025623149756',
      cookie: true,  // enable cookies to allow the server to access the session
      xfbml: true,  // parse social plugins on this page
      version: 'v2.5' // use graph api version 2.5
    });

    FB.getLoginStatus(response => {
      this.statusChangeCallback(response);
    });
  }

  public Login() {
    var self = this;
    FB.login(function (response) {
      self.statusChangeCallback(response);
    }, { scope: 'public_profile,email' });
  }

  public Logout() {
    this.storage.remove('user');
    this.storage.remove('accessToken');
  }

  private statusChangeCallback(resp) {

    var self = this;
    if (resp.status === 'connected') {

      console.log('connected');
      console.log(JSON.stringify(resp));
      self.IsConnected = true;

      console.log('Token: %s', resp.authResponse.accessToken);
      self.storage.set("accessToken", resp.authResponse.accessToken);

      self.storage.get("user").then((user) => {

        if (user) {
          console.log('User found in local storage: %s', JSON.stringify(user));
          self.User = new User().deserialize(user);
        }
        else {
          console.log('No user found in local storage.');

          FB.api('/me', { fields: 'id,name,email,picture' }, function (userResponse) {

            var user = {
              name: userResponse.name,
              email: userResponse.email,
              picture: userResponse.picture.data.url,
              role: 'user'
            }

            self.getUser(user.email).then((retrievedUser) => {

              console.log('User: %s', JSON.stringify(retrievedUser));

              if (!retrievedUser || !retrievedUser.name) {

                console.log('Creating new user');
                self.http.post(self.config.get('endPoint') + '/users', user).map(res => res.json()).subscribe(newUser => {
                  console.log('User created in database: %s', JSON.stringify(newUser));

                  self.storage.set("user", newUser);
                  self.User = new User().deserialize(newUser);
                });
              }
              else {
                self.storage.set("user", retrievedUser);
                self.User = new User().deserialize(retrievedUser);
              }
            });

            // self.http.get(self.config.get('endPoint') + '/users?email=' + user.email)
            //   .map(res => res.json())
            //   .catch(error => Observable.throw(error.json().error || 'Server error'))
            //   .subscribe(data => {


            //   });

          });
        }
      }, (rejected) => {
        console.log('Rejected: %s', rejected);
      });

    } else if (resp.status === 'not_authorized') {
      self.IsConnected = false;
      console.log('not_authorized');
      console.log(JSON.stringify(resp));
      self.storage.remove('user');
      self.storage.remove('accessToken');
    } else {
      self.storage.remove('user');
      self.storage.remove('accessToken');
      console.log(JSON.stringify(resp));
    }
  };

  getUser(email: string): Promise<User> {
    return this.http.get(this.config.get('endPoint') + '/users?email=' + email)
      .map(response => {

        console.log('User from response (' + response.status + '): ' + JSON.stringify(response.json()));
        
        var users = response.json();
        if (users.length == 1) {
          return new User().deserialize(users[0]);
        }
        else if (users.length == 0) {
          return null;
        }
        else {
          throw 'More than 1 user with the specified email (' + email + ') was found.';
        }
      })
      .toPromise();
  }
}