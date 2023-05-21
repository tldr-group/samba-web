from flask import Flask, request, make_response, jsonify


app = Flask(__name__)


def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "*")
    response.headers.add("Access-Control-Allow-Methods", "*")
    return response


def _corsify_actual_response(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response


@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
def encode():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        request_json = request.get_json()
        # img_str = request_json["messsage"]
        order = {"message": request.json["message"]}
        return _corsify_actual_response(jsonify(order))
    else:
        raise RuntimeError(
            "Weird - don't know how to handle method {}".format(request.method)
        )
