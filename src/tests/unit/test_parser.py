import pytest
from fastapi import HTTPException

from utils.parser import assert_safe_url, parse_ingredient


class TestParseIngredient:
    def test_quantity_unit_name(self):
        assert parse_ingredient("1 tablespoon olive oil") == {
            "name": "olive oil",
            "quantity": "1",
            "measurement_type": "tablespoon",
        }

    def test_metric_with_parenthetical(self):
        r = parse_ingredient("250 g (9 oz) rigatoni")
        assert r["quantity"] == "250"
        assert r["measurement_type"] == "g"
        assert "rigatoni" in r["name"]

    def test_mixed_fraction(self):
        r = parse_ingredient("1 1/2 cups flour")
        assert r["quantity"] == "1 1/2"
        assert r["measurement_type"] == "cups"
        assert r["name"] == "flour"

    def test_unicode_fraction(self):
        r = parse_ingredient("½ tsp salt")
        assert r["quantity"] == "1/2"
        assert r["measurement_type"] == "tsp"
        assert r["name"] == "salt"

    def test_descriptor_not_treated_as_unit(self):
        r = parse_ingredient("1 large shallot, finely chopped")
        assert r["quantity"] == "1"
        assert r["measurement_type"] == ""
        assert r["name"] == "large shallot, finely chopped"

    def test_no_quantity(self):
        r = parse_ingredient("Salt and pepper to taste")
        assert r == {
            "name": "Salt and pepper to taste",
            "quantity": "",
            "measurement_type": "",
        }


class TestSsrfGuard:
    @pytest.mark.parametrize(
        "url",
        [
            "http://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1/",
            "http://10.0.0.5/internal",
            "ftp://example.com/x",
        ],
    )
    def test_disallowed_urls_rejected(self, url):
        with pytest.raises(HTTPException):
            assert_safe_url(url)
