var express = require('express');
var app = express()
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var setupgame = require('./setupgame.js');
var scoring = require('./scoring.js')

app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

//app.get('/how-to-play', function (req, res) {
//    res.sendFile(__dirname + '/how-to-play.html');
//});

http.listen(port, function(){
  console.log('listening on *:' + port);
});


var all_rooms = {
    '1': {},
    '2': {},
    '3': {},
    '4': {},
    '5': {},
    '6': {},
    '7': {},
    '8': {},
    '9': {},
    '10': {}
};
var players_name_dict = {
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
    '6': [],
    '7': [],
    '8': [],
    '9': [],
    '10': []
}





io.on('connection', function (socket) {
  
  socket.join('waiting_room')
  
  socket.emit('table_firstload', players_name_dict)

    socket.on("join_room", function (room_number, player_name) {

        socket.leave('waiting_room')
      
        players_name_dict[room_number].push(player_name)
        socket.join(room_number)
        //put player in waiting room, also emits to all players in that room
        io.to(room_number).emit('in_room', players_name_dict[room_number], room_number, all_rooms[room_number])
        //update table to reflect player joining a room
        io.to('waiting_room').emit('update_table', room_number, players_name_dict[room_number])
        
        all_rooms[room_number][socket.id] = {
            id: socket.id,
            username: player_name
          };
    })
    // start game when room has emitted that it has 4 players
    socket.on('load_game', function(room_num) {
        
        setupgame.setupgame(all_rooms[room_num])
        
        
        // load inital game
        io.to(room_num).emit('load_4', all_rooms[room_num]);
        // set_player_turn
        io.to(room_num).emit('set_player_turn', all_rooms[room_num][Object.keys(all_rooms[room_num])[0]].ordered_players[0])
      
        io.to(room_num).emit('draw_tile')
        
        
    })
  
    socket.on('new_round_to_server', function(players_in_order, banker, room_num){
       var new_tiles = setupgame.newround(players_in_order)
       
        io.to(room_num).emit('new_round_to_client', new_tiles)

        io.to(room_num).emit('set_player_turn', banker)

        io.to(room_num).emit('draw_tile')
    })

      socket.on("check_win", function (player_tile, own_index, prevailing_wind, socketid, all, room_num) {
        var to_check = scoring.check_win(player_tile.tiles_in_hand)

        if (to_check != false){
          
          // li, last, player_wind, prevailing_wind, hua_array, self
          var eyes = to_check.pop()
          
          var to_add_arr = []
          
          for (let i = 0; i < player_tile.tiles_in_board.length ; i += 3){
            
            if (scoring.is_valid_gang(player_tile.tiles_in_board.slice(i, i + 4))){
            
            let to_add = player_tile.tiles_in_board.splice(i + 3, 1)
            
            to_add_arr.push(to_add[0], i + 3)
            }
            
            to_check.push(player_tile.tiles_in_board.slice(i, i + 3))
            
          }

          to_check.push(eyes)
          
          var tai_won = scoring.calculate_tai(to_check, null, own_index , prevailing_wind, player_tile.hua_array, true)
          
        }

        if (tai_won > 0) {
          
          for (let i = 0; i < to_add_arr.length; i = i + 2){
          player_tile.tiles_in_board[to_add_arr[i + 1]] = to_add_arr[i]
          }
          
            io.to(room_num).emit('option_to_win', socketid, tai_won, player_tile, socketid, all)
          return
        }
        
        else 
            io.to(room_num).emit('discard')
        
      })

      socket.on('continue_round', function(room_num){
          io.to(room_num).emit('discard')
      })
  
      socket.on('continue_round_from_other', function(tiles, socketid, all, room_num){
          io.to(room_num).emit('discard_to_client', tiles, socketid, all)
      })

      socket.on('discard_to_server', function(tiles, socketid, right, opposite, left, all, own_index, prevailing_wind, rightid, oppid, leftid, room_num){
        var to_add = tiles.discard_tile[0]
        
        right.tiles_in_hand.push(to_add)
        to_check_right = scoring.check_win(right.tiles_in_hand)
        
        
        if (to_check_right != false){
          
          var eyes = to_check_right.pop()
          
          for (let i = 0; i < right.tiles_in_board.length ; i += 3){
            if (scoring.is_valid_gang(right.tiles_in_board.slice(i, i + 4))){
              right.tiles_in_board.splice(i, 1)
              }
            
            to_check_right.push(right.tiles_in_board.slice(i, i + 3))
          }

          to_check_right.push(eyes)
          console.log(to_check_right)
          var tai_won_right = scoring.calculate_tai(to_check_right, to_add, ((own_index+ 1) %4), prevailing_wind, right.hua_array, false)
          console.log(tai_won_right)
        }

        if (tai_won_right > 0){
            io.to(room_num).emit('option_to_win', rightid, tai_won_right, tiles, socketid, all)
          return
        }

        opposite.tiles_in_hand.push(to_add)
        to_check_opp = scoring.check_win(opposite.tiles_in_hand)
        
        if (to_check_opp != false){
          var eyes = to_check_opp.pop()
          
          for (let i = 0; i < opposite.tiles_in_board.length ;i += 3){
            if (scoring.is_valid_gang(opposite.tiles_in_board.slice(i, i + 4))){
              opposite.tiles_in_board.splice(i, 1)
              }
            
            to_check_opp.push(opposite.tiles_in_board.slice(i, i + 3))
          
          }

          to_check_opp.push(eyes)
          console.log(to_check_opp)
          var tai_won_opp = scoring.calculate_tai(to_check_opp, to_add, ((own_index+ 2) % 4 ), prevailing_wind, opposite.hua_array, false)
          console.log(tai_won_opp)
        }

        if (tai_won_opp > 0){
            io.to(room_num).emit('option_to_win', oppid, tai_won_opp, tiles, socketid, all)
          return
        }

        left.tiles_in_hand.push(to_add)
        to_check_left = scoring.check_win(left.tiles_in_hand)
        
        if (to_check_left != false){
          
          var eyes = to_check_left.pop()

          var to_add_arr = []
          
          
          for (let i = 0; i < left.tiles_in_board.length ; i += 3){
            if (scoring.is_valid_gang(left.tiles_in_board.slice(i, i + 4))){
              left.tiles_in_board.splice(i, 1)
              }

            
            to_check_left.push(left.tiles_in_board.slice(i, i + 3))
            
          
          }

          to_check_left.push(eyes)
          
          var tai_won_left = scoring.calculate_tai(to_check_left, to_add, ((own_index+ 3) %4), prevailing_wind, left.hua_array, true)
          console.log(tai_won_left)
        }

        if (tai_won_left > 0){
            io.to(room_num).emit('option_to_win', leftid, tai_won_left, tiles, socketid, all)
          return
        }
        
          io.to(room_num).emit('discard_to_client', tiles, socketid, all)
      })

      socket.on('peng_to_server', function(tiles, socketid, room_num){
          io.to(room_num).emit('peng_to_clients', tiles, socketid)
    })

      socket.on('request_special_change', function(data, room_num){
          io.to(room_num).emit('set_player_turn', data)
          io.to(room_num).emit('discard')
      })

      socket.on('request_normal_change', function(data, room_num){
          io.to(room_num).emit('set_player_turn', data)
  
          io.to(room_num).emit('draw_tile')
      })

      socket.on('chi_to_server', function(tiles, socketid, room_num){
          io.to(room_num).emit('chi_to_clients', tiles, socketid)
    })

    

      socket.on('update_discard_pile', function(data, room_num){
          io.to(room_num).emit('discard_board_to_client', data)
      })

      socket.on('round_won_to_server', function(data, tiles, room_num){
          io.to(room_num).emit('round_won_to_client', data, tiles)
      })

      // for less than 15 tiles
      socket.on('end_game_to_server', function(data, tiles, room_num){
        io.to(room_num).emit('end_game_to_client', data, tiles)
      })


    socket.on('disconnecting', function () {
        var self = this;
        var current_room = Object.keys(self.rooms);

        
        if (current_room[1] != 'waiting_room'){

        // players_names_dictionary
        var pos_finder = Object.keys(all_rooms[current_room[0]])

        
        for (let i = 0; i < pos_finder.length; i++){
          if (self.id == pos_finder[i]){
            players_name_dict[current_room[0]].splice(i, 1)
            // all_rooms
            delete all_rooms[current_room[0]][self.id]
            break;
          }
        }
        // to 3 other gamesjs, put them back in waiting stage
        self.to(current_room[0]).emit('in_room', players_name_dict[current_room[0]], current_room[0], all_rooms[current_room]);

        // to everyone in waiting room
        self.to('waiting_room').emit('update_table', current_room[0],players_name_dict[current_room[0]])
      }

    });
})
